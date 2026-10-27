"""Positive, negative and technical cases, only in the disposable container."""
import copy
import json
from pathlib import Path
import subprocess
import yaml

source = Path('/work/internal/probe/ra1.py').read_text()
kea = Path('/etc/kea/kea-dhcp4.conf')
nft = Path('/etc/nftables.conf')
original_kea, original_nft = kea.read_text(), nft.read_text()
checks = 0


def expect(criterion, want='OK', code=0):
    global checks
    p = subprocess.run(['python3', '-I', '-c', source, criterion, 'enp1s0', 'enp2s0', '192.168.236.60'],
                       capture_output=True, text=True, timeout=20)
    assert (p.stdout.strip(), p.returncode) == (want, code), (criterion, want, code, p.stdout, p.stderr, p.returncode)
    checks += 1


try:
    root = json.loads(original_kea)
    for compact in (True, False):
        kea.write_text(json.dumps(root, indent=None if compact else 4))
        for id in ('kea-reserva-mail', 'kea-reserva-impressora2', 'kea-rang-final', 'kea-interficie'):
            expect(id)
    part = Path('/etc/kea/qa-reservations.json')
    part.write_text(json.dumps(root['Dhcp4']['subnet4'][0]['reservations']))
    include = json.dumps(root).replace(json.dumps(root['Dhcp4']['subnet4'][0]['reservations']), '<?include "/etc/kea/qa-reservations.json"?>')
    kea.write_text('// multiline include\n' + include)
    expect('kea-reserva-mail')
    part.unlink()
    for mutate, criterion in (
        (lambda d: d['interfaces-config']['interfaces'].append('enp1s0'), 'kea-interficie'),
        (lambda d: d['subnet4'][0].update(pools=[{'pool':'10.23.97.100 - 10.23.97.150'}, {'pool':'10.23.98.1 - 10.23.98.93'}]), 'kea-rang-final'),
        (lambda d: d['subnet4'][0]['reservations'][0].update({'ip-address':'10.23.96.99'}), 'kea-reserva-mail'),
        (lambda d: d['subnet4'][0]['option-data'][0].update(data='10.23.97.2'), 'kea-porta-enllac')):
        bad = copy.deepcopy(root)
        mutate(bad['Dhcp4'])
        kea.write_text(json.dumps(bad))
        expect(criterion, 'FAIL')
    # A commented-out correct reservation cannot supply evidence.
    bad = copy.deepcopy(root)
    bad['Dhcp4']['subnet4'][0]['reservations'] = []
    kea.write_text('/* {"hw-address":"02:27:01:10:00:01","ip-address":"10.23.96.10"} */\n' + json.dumps(bad))
    expect('kea-reserva-mail', 'FAIL')
    kea.write_text(original_kea)

    net_files = {p: p.read_text() for p in Path('/etc/netplan').glob('*.yaml')}
    try:
        merged = {'network': {'version': 2, 'ethernets': {}}}
        for text in net_files.values():
            merged['network']['ethernets'].update(yaml.safe_load(text)['network'].get('ethernets', {}))
        for path in net_files:
            path.unlink()
        combined = Path('/etc/netplan/99-combined.yaml')
        combined.write_text(yaml.safe_dump(merged))
        for criterion in ('net-externa-netplan', 'net-interna-netplan', 'net-externa-gw', 'net-externa-dns'):
            expect(criterion)
        merged['network']['ethernets']['enp2s0']['addresses'] = ['10.23.97.1/16']
        combined.write_text(yaml.safe_dump(merged))
        expect('net-interna-ip', 'FAIL')
        combined.unlink()
    finally:
        for path, text in net_files.items():
            path.write_text(text)
            path.chmod(0o600)

    # Snapshot the actual host ruleset; saved-rule checks must not change it.
    before = subprocess.check_output(['nft', '-j', 'list', 'ruleset'])
    for criterion in ('nft-anada', 'nft-retorn', 'nft-masquerade'):
        expect(criterion)
    assert subprocess.check_output(['nft', '-j', 'list', 'ruleset']) == before
    # Valid iif/oif index rules, with matching reproduced interfaces.
    nft.write_text(original_nft.replace('oifname', 'oif').replace('iifname', 'iif'))
    expect('nft-anada')
    expect('nft-masquerade')
    nft.write_text(original_nft.replace('oifname "enp1s0" iifname "enp2s0" counter accept', 'drop\n  oifname "enp1s0" iifname "enp2s0" accept'))
    expect('nft-anada', 'FAIL')
    expect('nft-carregat-anada')  # loaded host is still good
    nft.write_text(original_nft.replace('counter accept', 'limit rate 2/second accept'))
    expect('nft-anada', '', 70)
    nft.write_text(original_nft)
    subprocess.run(['nft', 'insert', 'rule', 'inet', 'aula', 'forward', 'drop'], check=True)
    expect('nft-carregat-anada', 'FAIL')
    expect('nft-anada')  # saved host file is still good
finally:
    kea.write_text(original_kea)
    nft.write_text(original_nft)
    subprocess.run(['nft', '-f', str(nft)], check=True)
print('VARIANTS', checks, 'passed', flush=True)
