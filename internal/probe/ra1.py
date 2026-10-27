"""Fixed read-only RA1 checker. The teacher never supplies Python source.

OK and FAIL are academic answers (both exit 0). Every inability to observe,
unsupported construct or unexpected exception is exit 70, never a guessed FAIL.
Only the saved nftables rules are loaded, inside a fresh network namespace.
"""
import csv
import ctypes
import fnmatch
import io
import ipaddress as ip
import json
import os
from pathlib import Path
import re
import selectors
import shutil
import subprocess
import sys
import time


class Unavailable(Exception):
    pass


class Incorrect(Exception):
    pass


def run(args, academic=False, cwd=None):
    if shutil.which(args[0]) is None:
        if academic:
            raise Incorrect("No está instalado " + args[0])
        raise Unavailable("Falta una herramienta del comprobador: " + args[0])
    buffers = [bytearray(), bytearray()]
    deadline, size = time.monotonic() + 8, 0
    with subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, cwd=cwd,
                          env={**os.environ, "LC_ALL": "C", "LANG": "C"}) as process:
        try:
            with selectors.DefaultSelector() as selector:
                selector.register(process.stdout, selectors.EVENT_READ, 0)
                selector.register(process.stderr, selectors.EVENT_READ, 1)
                while selector.get_map():
                    left = deadline - time.monotonic()
                    if left <= 0:
                        raise Unavailable('La herramienta excedió su tiempo límite')
                    for key, _ in selector.select(left):
                        chunk = os.read(key.fd, 16384)
                        if not chunk:
                            selector.unregister(key.fileobj)
                            continue
                        size += len(chunk)
                        if size > 4 * 1024 * 1024:
                            raise Unavailable('La respuesta excede el límite del comprobador')
                        buffers[key.data].extend(chunk)
            process.wait(timeout=max(0.01, deadline - time.monotonic()))
        except BaseException:
            process.kill()
            process.wait()
            raise
        return subprocess.CompletedProcess(args, process.returncode,
                                           *(b.decode('utf-8', errors='replace') for b in buffers))


def output(args, academic=False):
    p = run(args, academic)
    if p.returncode:
        raise Unavailable("No se pudo leer " + args[0] + ": " + p.stderr[:500])
    return p.stdout


def read(path):
    try:
        with Path(path).open() as stream:
            # procfs sysctl handlers can allocate the requested read size in
            # the kernel. Small reads avoid ENOMEM on an ordinary scalar.
            chunks, size = [], 0
            while True:
                chunk = stream.read(4096)
                if not chunk:
                    break
                size += len(chunk)
                if size > 4 * 1024 * 1024:
                    raise Unavailable('Archivo demasiado grande: ' + str(path))
                chunks.append(chunk)
            data = ''.join(chunks)
    except FileNotFoundError:
        raise Incorrect("No existe " + str(path))
    return data


def decode(data):
    try:
        return json.loads(data)
    except (ValueError, TypeError) as e:
        raise Unavailable("La herramienta devolvió datos ilegibles: " + str(e))


def uncomment(text, cwd=Path('/'), stack=()):
    """Lex JSON strings, comments and Kea includes without damaging string data."""
    out, i, size = [], 0, 0
    while i < len(text):
        if text[i] == '"':
            start = i
            i += 1
            while i < len(text):
                if text[i] == '\\':
                    i += 2
                elif text[i] == '"':
                    i += 1
                    break
                else:
                    i += 1
            out.append(text[start:i])
        elif text.startswith('/*', i):
            end = text.find('*/', i + 2)
            if end < 0:
                raise Incorrect("Comentario sin cerrar")
            out.append(' ')
            i = end + 2
        elif text[i] == '#' or text.startswith('//', i):
            end = text.find('\n', i)
            i = len(text) if end < 0 else end
            out.append('\n')
        elif text.startswith('<?include', i):
            m = re.match(r'<\?include\s+("(?:[^"\\]|\\.)*")\s*\?>', text[i:])
            if not m:
                raise Incorrect("Inclusión de Kea inválida")
            path = (cwd / json.loads(m[1])).resolve()
            if path in stack or len(stack) >= 10:
                raise Incorrect("Inclusiones cíclicas o demasiado profundas")
            out.append(uncomment(read(path), cwd, (*stack, path)))
            i += len(m[0])
        else:
            out.append(text[i])
            i += 1
        size += len(out[-1])
        if size > 8 * 1024 * 1024:
            raise Unavailable("Inclusión demasiado grande")
    result = ''.join(out)
    if len(result) > 8 * 1024 * 1024:
        raise Unavailable("Configuración expandida demasiado grande")
    # Trailing commas are allowed by Kea. Strings stay untouched.
    return re.sub(r'("(?:[^"\\]|\\.)*")|,\s*(?=[}\]])', lambda m: m[1] or '', result)


def kea():
    path = '/etc/kea/kea-dhcp4.conf'
    text = read(path)
    cwd_text = output(['systemctl', 'show', 'kea-dhcp4-server', '-p', 'WorkingDirectory', '--value']).strip()
    cwd = Path(cwd_text or '/')
    if not cwd.is_absolute():
        raise Unavailable("Directorio de trabajo de Kea no interpretable")
    # The actual Kea parser decides whether its extended JSON is valid.
    p = run(['kea-dhcp4', '-t', path], academic=True, cwd=cwd)
    if p.returncode:
        raise Incorrect("Kea rechaza su configuración: " + (p.stderr + p.stdout)[-500:])
    try:
        root = json.loads(uncomment(text, cwd))['Dhcp4']
    except (ValueError, KeyError, TypeError) as e:
        raise Incorrect("Configuración de Kea inválida: " + str(e))
    if not isinstance(root, dict):
        raise Incorrect("Falta la configuración DHCPv4")
    subnets = [(s, {}) for s in root.get('subnet4', [])]
    for shared in root.get('shared-networks', []):
        subnets.extend((s, shared) for s in shared.get('subnet4', []))
    matching = [(s, parent) for s, parent in subnets
                if ip.ip_network(s['subnet'], strict=False) == ip.ip_network('10.0.0.0/8')]
    if len(matching) != 1:
        raise Incorrect("No hay una única subred aplicable")
    subnet, parent = matching[0]
    return root, parent, subnet, subnets


def inherited(root, parent, subnet, key, default=None):
    return subnet.get(key, parent.get(key, root.get(key, default)))


def option(root, parent, subnet, name, code):
    for scope in (subnet, parent, root):
        choices = [o for o in scope.get('option-data', [])
                   if o.get('space', 'dhcp4') == 'dhcp4' and
                   (o.get('name') == name or o.get('code') == code)]
        if choices:
            if len(choices) != 1 or choices[0].get('never-send', False):
                return []
            o = choices[0]
            if o.get('client-classes'):
                raise Unavailable("Opción condicionada por clases de cliente")
            if o.get('csv-format', True):
                return [str(ip.IPv4Address(x.strip())) for x in o['data'].split(',')]
            raw = bytes.fromhex(o['data'].replace(':', '').replace(' ', ''))
            return [str(ip.IPv4Address(raw[i:i+4])) for i in range(0, len(raw), 4)]
    return []


def pool_range(pool):
    parts = pool['pool'].split('-')
    if len(parts) == 2:
        return tuple(ip.IPv4Address(x.strip()) for x in parts)
    network = ip.ip_network(pool['pool'], strict=False)
    return network.network_address, network.broadcast_address


def kea_check(criterion, internal):
    root, parent, subnet, subnets = kea()
    if criterion == 'kea-subxarxa':
        return True
    if criterion == 'kea-interficie':
        interfaces = root.get('interfaces-config', {}).get('interfaces', [])
        return len(interfaces) == 1 and interfaces[0] in (internal, internal + '/10.23.97.1')
    if criterion.startswith('kea-rang-'):
        pools = [p for s, _ in subnets for p in s.get('pools', [])]
        if len(pools) != 1 or len(subnet.get('pools', [])) != 1:
            return False
        start, end = pool_range(pools[0])
        if criterion == 'kea-rang-inici':
            return start == ip.IPv4Address('10.23.97.100') and end >= start
        return (start == ip.IPv4Address('10.23.97.100') and
                end == ip.IPv4Address('10.23.98.93') and int(end) - int(start) + 1 == 250)
    if criterion == 'kea-porta-enllac':
        return option(root, parent, subnet, 'routers', 3) == ['10.23.97.1']
    if criterion == 'kea-dns':
        return option(root, parent, subnet, 'domain-name-servers', 6) == ['9.9.9.9']
    pairs = {'kea-reserva-mail': ('02:27:01:10:00:01', '10.23.96.10'),
             'kea-reserva-web': ('02:27:01:10:00:02', '10.23.96.11'),
             'kea-reserva-impressora1': ('02:27:01:20:00:01', '10.23.96.50'),
             'kea-reserva-impressora2': ('02:27:01:20:00:02', '10.23.96.51')}
    mac, address = pairs[criterion]
    if 'hw-address' not in root.get('host-reservation-identifiers', ['hw-address']):
        return False
    reservations = []
    if inherited(root, parent, subnet, 'reservations-in-subnet', True):
        reservations.extend(subnet.get('reservations', []))
    if inherited(root, parent, subnet, 'reservations-global', False):
        reservations.extend(root.get('reservations', []))
    def normalized_mac(value):
        return ':'.join(f'{int(x, 16):02x}' for x in value.strip().split(':')) if value else ''
    matching = [r for r in reservations if normalized_mac(r.get('hw-address', '')) == mac]
    return bool(matching) and all(r.get('ip-address') == address for r in matching)


def interface_config(config, interface, links):
    matches = []
    mac = next((x.get('address', '').lower() for x in links if x.get('ifname') == interface), '')
    for name, item in config.get('network', {}).get('ethernets', {}).items():
        match = item.get('match')
        if match is None:
            applies = name == interface
        else:
            applies = (item.get('set-name') in (None, interface) and
                       (item.get('set-name') == interface or
                        fnmatch.fnmatchcase(interface, match.get('name', '*'))) and
                       match.get('macaddress', mac).lower() == mac)
            if set(match) - {'name', 'macaddress'}:
                raise Unavailable("Netplan utiliza un criterio de selección no soportado")
        if applies:
            matches.append(item)
    if len(matches) > 1:
        raise Unavailable("Varias definiciones Netplan seleccionan la misma interfaz")
    return matches[0] if matches else {}


def addresses(config):
    return [str(ip.ip_interface(next(iter(x)) if isinstance(x, dict) else x))
            for x in config.get('addresses', [])]


def defaults(config):
    result = [config['gateway4']] if config.get('gateway4') else []
    result.extend(r.get('via') for r in config.get('routes', [])
                  if r.get('to') in ('default', '0.0.0.0/0'))
    return result


def net_check(criterion, external, internal, exam_ip):
    if criterion == 'net-resolucio':
        return run(['getent', 'ahostsv4', 'upc.edu']).returncode == 0
    if criterion == 'net-sortida':
        routes = decode(output(['ip', '-j', '-4', 'route', 'get', '9.9.9.9']))
        return bool(routes) and all(r.get('dev') == external for r in routes)
    try:
        import yaml
    except ImportError:
        raise Unavailable("Falta el lector YAML de Netplan (python3-yaml)")
    raw = run(['netplan', 'get'])
    if raw.returncode:
        raise Incorrect("Netplan rechaza la configuración guardada: " + raw.stderr[:400])
    try:
        config = yaml.safe_load(raw.stdout)
    except yaml.YAMLError:
        raise Incorrect("La configuración Netplan combinada no es válida")
    links = decode(output(['ip', '-j', 'link', 'show']))
    interface = external if criterion.startswith('net-externa') else internal
    cfg = interface_config(config or {}, interface, links)
    if not cfg:
        return False
    state = decode(output(['ip', '-j', '-4', 'address', 'show', 'dev', interface]))
    active = [a for link in state for a in link.get('addr_info', []) if a.get('family') == 'inet']
    persistent = addresses(cfg)
    expected = exam_ip if interface == external else '10.23.97.1'
    expected_addresses = [a for a in persistent if str(ip.ip_interface(a).ip) == expected]
    if interface == internal:
        expected_addresses = [a for a in expected_addresses if a.endswith('/8')]
    correct = any(a.get('local') == expected and
                  f"{expected}/{a['prefixlen']}" in expected_addresses for a in active)
    if criterion.endswith('-ip'):
        return correct
    if criterion == 'net-externa-estatica':
        return correct and not cfg.get('dhcp4', False) and any(
            a.get('local') == expected and not a.get('dynamic', False) and
            'dynamic' not in a.get('flags', []) and
            a.get('valid_life_time') in ('forever', 4294967295) for a in active)
    if criterion.endswith('-netplan'):
        return correct and not cfg.get('dhcp4', False)
    runtime_defaults = decode(output(['ip', '-j', '-4', 'route', 'show', 'default', 'dev', interface]))
    if criterion == 'net-externa-gw':
        return '192.168.236.1' in defaults(cfg) and any(
            r.get('gateway') == '192.168.236.1' for r in runtime_defaults)
    if criterion == 'net-externa-dns':
        dns = output(['resolvectl', 'dns', interface])
        actual = re.findall(r'(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])', dns)
        return ('192.168.236.1' in cfg.get('nameservers', {}).get('addresses', []) and
                '192.168.236.1' in actual)
    return not defaults(cfg) and not runtime_defaults and not cfg.get('dhcp4', False)


def forwarding(criterion):
    if criterion == 'fwd-actiu':
        return read('/proc/sys/net/ipv4/ip_forward').strip() == '1'
    # systemd-sysctl prints the exact merged boot configuration, respecting
    # basename masking and /dev/null links. /etc/sysctl.conf counts if included.
    binary = next((p for p in ('/usr/lib/systemd/systemd-sysctl', '/lib/systemd/systemd-sysctl')
                   if Path(p).is_file()), None)
    if binary is None:
        raise Unavailable("No se puede consultar la configuración sysctl de arranque")
    text = output([binary, '--cat-config'])
    value = None
    for line in text.splitlines():
        line = re.split(r'[#;]', line, maxsplit=1)[0].strip()
        if '=' not in line:
            continue
        key, entry = line.split('=', 1)
        if key.strip().lstrip('-').replace('/', '.') == 'net.ipv4.ip_forward':
            value = entry.strip()
    return value == '1'


def isolate_network():
    # Only this short-lived checker process changes namespaces. The SSH
    # session, its supervisor and the student's host remain in their own.
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.unshare(0x40000000) != 0:  # CLONE_NEWNET
        raise Unavailable('No se pudo aislar la red: ' + os.strerror(ctypes.get_errno()))


def ruleset(saved):
    if shutil.which('nft') is None:
        raise Incorrect("No está instalado nftables")
    if not saved:
        return decode(output(['nft', '-j', 'list', 'ruleset']))
    read('/etc/nftables.conf')
    links = decode(output(['ip', '-j', 'link', 'show']))
    isolate_network()
    output(['nft', '-j', 'list', 'ruleset'])  # prove NET_ADMIN before grading syntax
    # iif/oif can reference interface indexes; reproduce names and indexes in
    # isolation so those valid rules also load, without touching real links.
    for link in links:
        if link['ifname'] != 'lo':
            output(['ip', 'link', 'add', 'name', link['ifname'], 'index', str(link['ifindex']), 'type', 'dummy'])
    p = run(['nft', '-f', '/etc/nftables.conf'])
    if p.returncode:
        raise Incorrect("nftables rechaza el archivo guardado: " + p.stderr[:400])
    # Listing in a second transaction is essential: nft can list chains but
    # omit newly staged rules when list and load occur in the same batch.
    return decode(output(['nft', '-j', 'list', 'ruleset']))


def nft_value(expr, packet):
    if isinstance(expr, (str, int)):
        return expr
    if isinstance(expr, list):
        return [nft_value(x, packet) for x in expr]
    if not isinstance(expr, dict) or len(expr) != 1:
        raise Unavailable("Expresión nftables no soportada")
    kind, value = next(iter(expr.items()))
    if kind == 'meta':
        key = value['key']
        if key in ('iifname', 'oifname', 'l4proto', 'nfproto'):
            return packet[key]
        if key in ('iif', 'oif'):
            return {'interface-index': (packet[key + 'name'], packet.get(key + 'index'))}
    if kind == 'ct' and value.get('key') == 'state':
        return packet['state']
    if kind == 'payload':
        protocol, field = value.get('protocol'), value.get('field')
        if protocol == 'ip' and field in ('saddr', 'daddr'):
            return packet[field]
        if protocol in ('tcp', 'udp') and field in ('sport', 'dport'):
            return packet[field] if packet['l4proto'] == protocol else None
    if kind in ('prefix', 'range', 'set'):
        return {kind: value}
    raise Unavailable("Expresión nftables no soportada: " + str(kind))


def member(left, right, sets, packet):
    if isinstance(right, str) and right.startswith('@'):
        name = right[1:]
        if name not in sets:
            raise Unavailable("Conjunto nftables no disponible: " + name)
        right = {'set': sets[name]}
    if isinstance(right, dict):
        if 'set' in right:
            return any(member(left, nft_value(x, packet), sets, packet) for x in right['set'])
        if 'prefix' in right:
            p = right['prefix']
            return ip.ip_address(left) in ip.ip_network(f"{p['addr']}/{p['len']}", strict=False)
        if 'range' in right:
            low, high = right['range']
            return low <= left <= high
        raise Unavailable("Comparación nftables no soportada")
    if isinstance(right, list):
        return any(member(left, x, sets, packet) for x in right)
    if isinstance(left, dict) and 'interface-index' in left:
        name, index = left['interface-index']
        if isinstance(right, int) and index is None:
            raise Unavailable('No se pudo resolver el índice de interfaz')
        return (index if isinstance(right, int) else name) == right
    if isinstance(left, str) and isinstance(right, str) and '*' in right:
        return fnmatch.fnmatchcase(left, right)
    return left == right


def nft_verdict(data, hook, packet):
    objects = data.get('nftables', [])
    chains, rules, sets = {}, {}, {}
    for item in objects:
        if 'chain' in item:
            c = item['chain']
            if c['family'] in ('ip', 'inet'):
                chains[c['family'], c['table'], c['name']] = c
        elif 'rule' in item:
            r = item['rule']
            rules.setdefault((r['family'], r['table'], r['chain']), []).append(r)
        elif 'set' in item:
            s = item['set']
            sets[s['family'], s['table'], s['name']] = s.get('elem', [])
    bases = [(k, c) for k, c in chains.items() if c.get('hook') == hook]
    bases.sort(key=lambda pair: pair[1].get('prio', 0))
    if not bases:
        return False

    def chain(key, depth=0):
        if depth > 16 or key not in chains:
            raise Unavailable("Salto nftables cíclico o cadena no disponible")
        local_sets = {name: value for (family, table, name), value in sets.items()
                      if (family, table) == key[:2]}
        for rule in rules.get(key, []):
            expressions = rule.get('expr', [])
            unknown, matches = None, True
            for e in expressions:
                if 'match' not in e:
                    continue
                m = e['match']
                try:
                    left, right = nft_value(m['left'], packet), nft_value(m['right'], packet)
                    yes = member(left, right, local_sets, packet)
                    if m['op'] == '!=':
                        yes = not yes
                    elif m['op'] not in ('==', 'in'):
                        raise Unavailable("Operador nftables no soportado: " + m['op'])
                    matches = matches and yes
                except Unavailable as err:
                    unknown = err
            if not matches:
                continue
            if unknown:
                raise unknown
            for e in expressions:
                for kind, value in e.items():
                    if kind in ('match', 'counter', 'log', 'comment'):
                        continue
                    if kind in ('accept', 'drop', 'reject', 'masquerade', 'return'):
                        return kind
                    if kind in ('jump', 'goto'):
                        verdict = chain((*key[:2], value['target']), depth + 1)
                        if verdict not in ('return', None):
                            return verdict
                        if kind == 'goto':
                            return 'return'
                    else:
                        raise Unavailable("Acción nftables no soportada: " + kind)
        return None

    masquerade = False
    for key, base in bases:
        verdict = chain(key)
        if verdict in ('drop', 'reject') or (verdict in (None, 'return') and base.get('policy', 'accept') == 'drop'):
            return False
        if verdict == 'masquerade':
            masquerade = True
            break
    return masquerade if hook == 'postrouting' else True


def nft_check(criterion, external, internal):
    saved = criterion in ('nft-anada', 'nft-retorn', 'nft-masquerade')
    indexes = {x['ifname']: x['ifindex'] for x in decode(output(['ip', '-j', 'link', 'show']))}
    data = ruleset(saved)
    nat = 'masquerade' in criterion
    returning = criterion == 'nft-retorn'
    for client in ('10.23.97.100', '10.23.98.93', '10.23.96.10'):
        for protocol, port in (('tcp', 80), ('udp', 53), ('icmp', 0)):
            packet = {'iifname': external if returning else internal,
                      'oifname': internal if returning else external,
                      'iifindex': indexes.get(external if returning else internal),
                      'oifindex': indexes.get(internal if returning else external),
                      'saddr': '9.9.9.9' if returning else client,
                      'daddr': client if returning else '9.9.9.9',
                      'state': 'established' if returning else 'new',
                      'l4proto': protocol, 'nfproto': 'ipv4',
                      'sport': port if returning else 45123,
                      'dport': 45123 if returning else port}
            if not nft_verdict(data, 'postrouting' if nat else 'forward', packet):
                return False
    return True


def client_lease():
    root, parent, subnet, _ = kea()
    database = root.get('lease-database', {})
    if database.get('type', 'memfile') != 'memfile':
        raise Unavailable("El comprobador no puede leer esta base de concesiones")
    path = database.get('name', '/var/lib/kea/kea-leases4.csv')
    if not database.get('persist', True):
        raise Unavailable("Kea no conserva concesiones que se puedan consultar")
    # Kea's LFC rotation keeps older live leases in .2 (and, while cleaning,
    # .1). A completed snapshot supersedes both. The current file is newest.
    completed = Path(path + '.completed')
    older = [completed] if completed.is_file() else [Path(path + '.2'), Path(path + '.1')]
    files = [f for f in older if f.is_file()] + [Path(path)]
    rows = {}
    for file in files:
        try:
            data = read(file)
        except Incorrect:
            raise Unavailable('El registro de concesiones cambió durante su lectura; repite la comprobación')
        reader = csv.DictReader(io.StringIO(data))
        required = {'address', 'hwaddr', 'valid_lifetime', 'expire', 'subnet_id'}
        if not required.issubset(reader.fieldnames or []):
            raise Unavailable('Formato de registro de concesiones no soportado')
        for row in reader:
            rows[row.get('address')] = row
    if not rows:
        return False
    for address, row in rows.items():
        addr = ip.IPv4Address(address)
        if not ip.IPv4Address('10.23.97.100') <= addr <= ip.IPv4Address('10.23.98.93'):
            continue
        if (row.get('hwaddr') and row.get('state', '0') == '0' and
            int(row.get('subnet_id', 0)) == subnet.get('id') and
            int(row['valid_lifetime']) > 0 and int(row['expire']) > time.time()):
            return True
    return False


def evaluate(criterion, external, internal, exam_ip):
    if criterion.startswith('net-'):
        return net_check(criterion, external, internal, exam_ip)
    if criterion in ('kea-actiu', 'nft-actiu', 'nft-habilitat'):
        service = 'kea-dhcp4-server' if criterion.startswith('kea') else 'nftables'
        if output(['systemctl', 'show', service, '-p', 'LoadState', '--value']).strip() == 'not-found':
            return False
        action = 'is-enabled' if criterion == 'nft-habilitat' else 'is-active'
        expected = 'enabled' if action == 'is-enabled' else 'active'
        p = run(['systemctl', action, service])
        return p.returncode == 0 and p.stdout.strip() == expected
    if criterion.startswith('kea-'):
        return kea_check(criterion, internal)
    if criterion.startswith('fwd-'):
        return forwarding(criterion)
    if criterion.startswith('nft-'):
        return nft_check(criterion, external, internal)
    if criterion == 'client-concessio':
        return client_lease()
    raise Unavailable("Criterio del comprobador desconocido")


def main(args):
    try:
        if len(args) != 4:
            raise Unavailable("Argumentos del comprobador incompletos")
        result = evaluate(*args)
        print('OK' if result else 'FAIL')
        return 0
    except Incorrect as err:
        print('FAIL')
        print(str(err), file=sys.stderr)
        return 0
    except Exception as err:
        print('No se pudo comprobar: ' + type(err).__name__ + ': ' + str(err), file=sys.stderr)
        return 70


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
