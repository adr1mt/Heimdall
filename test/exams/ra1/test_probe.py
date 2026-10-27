import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('ra1', Path(__file__).resolve().parents[3] / 'internal/probe/ra1.py')
p = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(p)


def good_kea():
    return {'interfaces-config': {'interfaces': ['lan0']}, 'subnet4': [
        {'id': 1, 'subnet': '10.0.0.0/8', 'pools': [{'pool': '10.23.97.100 - 10.23.98.93'}],
         'option-data': [{'name': 'routers', 'data': '10.23.97.1'},
                         {'name': 'domain-name-servers', 'data': '9.9.9.9'}],
         'reservations': [{'hw-address': '02:27:01:10:00:01', 'ip-address': '10.23.96.10'}]}]}


def tree(root):
    s = root['subnet4'][0]
    return root, {}, s, [(s, {})]


def all_reservations():
    root = good_kea()
    root['subnet4'][0]['reservations'].extend([
        {'hw-address': '02:27:01:10:00:02', 'ip-address': '10.23.96.11'},
        {'hw-address': '02:27:01:20:00:01', 'ip-address': '10.23.96.50'},
        {'hw-address': '02:27:01:20:00:02', 'ip-address': '10.23.96.51'}])
    return root


def meta(key, val, op='=='):
    return {'match': {'op': op, 'left': {'meta': {'key': key}}, 'right': val}}


def nft_data(rules, hook='forward', policy='drop'):
    return {'nftables': [
        {'chain': {'family': 'inet', 'table': 'test', 'name': 'base', 'type': 'filter',
                   'hook': hook, 'prio': 0, 'policy': policy}},
        *[{'rule': {'family': 'inet', 'table': 'test', 'chain': 'base', 'expr': r}} for r in rules]]}


class ProbeTests(unittest.TestCase):
    def test_proc_scalar_and_bounded_file_reads(self):
        # A huge read request against procfs can fail in the kernel even for
        # a two-byte sysctl. Exercise the real read path with small chunks.
        self.assertIn(p.read('/proc/sys/net/ipv4/ip_forward').strip(), ('0', '1'))
        with tempfile.NamedTemporaryFile(mode='w') as f:
            f.write('x' * (4 * 1024 * 1024 + 1))
            f.flush()
            with self.assertRaises(p.Unavailable):
                p.read(f.name)

    def test_subprocess_output_is_bounded_before_capture_finishes(self):
        with self.assertRaises(p.Unavailable):
            p.run([sys.executable, '-c', 'import sys;sys.stdout.write("x" * (5 * 1024 * 1024))'])

    def check_kea(self, root, name):
        with patch.object(p, 'kea', return_value=tree(root)):
            return p.kea_check(name, 'lan0')

    def test_grouped_reservations_require_all_four(self):
        root = all_reservations()
        self.assertTrue(self.check_kea(root, 'kea-reserves'))
        for index in range(4):
            missing = copy.deepcopy(root)
            missing['subnet4'][0]['reservations'].pop(index)
            self.assertFalse(self.check_kea(missing, 'kea-reserves'), index)
            wrong = copy.deepcopy(root)
            wrong['subnet4'][0]['reservations'][index]['ip-address'] = '10.23.96.99'
            self.assertFalse(self.check_kea(wrong, 'kea-reserves'), index)

    def test_grouped_reservations_accept_order_and_format_variants(self):
        root = all_reservations()
        root['subnet4'][0]['reservations'].reverse()
        for indent in (None, 4):
            text = json.dumps(root, indent=indent)
            parsed = json.loads(p.uncomment('/* valid reservations */\n' + text))
            self.assertTrue(self.check_kea(parsed, 'kea-reserves'))
        root['reservations'] = root['subnet4'][0].pop('reservations')
        root['reservations-global'] = True
        self.assertTrue(self.check_kea(root, 'kea-reserves'))
        root['reservations-global'] = False
        self.assertFalse(self.check_kea(root, 'kea-reserves'))

    def test_grouped_reservations_reject_crossed_and_conflicting_pairs(self):
        root = all_reservations()
        reservations = root['subnet4'][0]['reservations']
        reservations[0]['ip-address'], reservations[1]['ip-address'] = reservations[1]['ip-address'], reservations[0]['ip-address']
        self.assertFalse(self.check_kea(root, 'kea-reserves'))
        root = all_reservations()
        root['subnet4'][0]['reservations'].append(
            {'hw-address': '02:27:01:20:00:02', 'ip-address': '10.23.96.99'})
        self.assertFalse(self.check_kea(root, 'kea-reserves'))

    def test_grouped_reservations_permission_failure_is_technical(self):
        with patch.object(p, 'kea', side_effect=PermissionError('fixture access denied')):
            self.assertEqual(p.main(['kea-reserves', 'wan0', 'lan0', '192.168.236.60']), 70)

    def test_reservation_format_order_and_whitespace(self):
        for text in ('{"hw-address":"02:27:01:10:00:01","ip-address":"10.23.96.10"}',
                     '{"ip-address":"10.23.96.10",\n"hw-address":"02:27:01:10:00:01"}',
                     '{"hw-address":"02:27:01:10:00:01",\n\n\n\n"ip-address":"10.23.96.10"}'):
            root = good_kea()
            root['subnet4'][0]['reservations'] = [json.loads(p.uncomment(text))]
            self.assertTrue(self.check_kea(root, 'kea-reserva-mail'))

    def test_comment_cannot_supply_reservation(self):
        text = '{"reservations": [ /* {"hw-address":"02:27:01:10:00:01","ip-address":"10.23.96.10"} */ ]}'
        root = good_kea()
        root['subnet4'][0]['reservations'] = json.loads(p.uncomment(text))['reservations']
        self.assertFalse(self.check_kea(root, 'kea-reserva-mail'))

    def test_crossed_or_conflicting_reservations(self):
        root = good_kea()
        root['subnet4'][0]['reservations'] = [
            {'hw-address': '02:27:01:10:00:01', 'ip-address': '10.23.96.99'},
            {'hw-address': '02:27:01:10:00:99', 'ip-address': '10.23.96.10'}]
        self.assertFalse(self.check_kea(root, 'kea-reserva-mail'))
        root['subnet4'][0]['reservations'].append({'hw-address': '02:27:01:10:00:01', 'ip-address': '10.23.96.10'})
        self.assertFalse(self.check_kea(root, 'kea-reserva-mail'))

    def test_only_applicable_reservations_count(self):
        root = good_kea()
        root['reservations'] = root['subnet4'][0].pop('reservations')
        self.assertFalse(self.check_kea(root, 'kea-reserva-mail'))
        root['reservations-global'] = True
        self.assertTrue(self.check_kea(root, 'kea-reserva-mail'))

    def test_interface_exclusive(self):
        root = good_kea()
        self.assertTrue(self.check_kea(root, 'kea-interficie'))
        for values in (['lan0', 'wan0'], ['*'], []):
            root['interfaces-config']['interfaces'] = values
            self.assertFalse(self.check_kea(root, 'kea-interficie'))

    def test_one_pool_exactly_250(self):
        root = good_kea()
        self.assertTrue(self.check_kea(root, 'kea-rang-final'))
        for pools in ([{'pool': '10.23.97.100 - 10.23.97.150'}, {'pool': '10.23.98.1 - 10.23.98.93'}],
                      [{'pool': '10.23.97.100 - 10.23.98.94'}], []):
            root['subnet4'][0]['pools'] = pools
            self.assertFalse(self.check_kea(root, 'kea-rang-final'))

    def test_option_inheritance_code_and_csv(self):
        root = good_kea()
        root['option-data'] = root['subnet4'][0].pop('option-data')
        self.assertTrue(self.check_kea(root, 'kea-dns'))
        root['subnet4'][0]['option-data'] = [{'code': 6, 'data': '1.1.1.1'}]
        self.assertFalse(self.check_kea(root, 'kea-dns'))
        root['subnet4'][0]['option-data'] = [{'code': 6, 'csv-format': False, 'data': '09:09:09:09'}]
        self.assertTrue(self.check_kea(root, 'kea-dns'))

    def test_kea_strings_comments_and_trailing_commas(self):
        text = '{"url":"http://example/#part", # hi\n "a":[1,2,], /*hi*/}'
        self.assertEqual(json.loads(p.uncomment(text)), {'url': 'http://example/#part', 'a': [1, 2]})

    def test_kea_includes(self):
        with tempfile.TemporaryDirectory() as folder:
            f = Path(folder) / 'part.conf'
            f.write_text('"reservations": [],')
            self.assertEqual(json.loads(p.uncomment('{<?include "part.conf"?>}', Path(folder))), {'reservations': []})
            f.write_text('<?include "part.conf"?>')
            with self.assertRaises(p.Incorrect):
                p.uncomment('{<?include "part.conf"?>}', Path(folder))

    def test_netplan_ids_match_and_combination(self):
        links = [{'ifname': 'lan0', 'address': '02:00:00:00:00:01'}]
        config = {'network': {'ethernets': {'any-id': {'match': {'macaddress': '02:00:00:00:00:01'},
                     'set-name': 'lan0', 'addresses': ['10.23.97.1/8']}}}}
        self.assertEqual(p.addresses(p.interface_config(config, 'lan0', links)), ['10.23.97.1/8'])
        self.assertEqual(p.interface_config(config, 'wan0', []), {})
        config['network']['ethernets']['lan0'] = {}
        with self.assertRaises(p.Unavailable):
            p.interface_config(config, 'lan0', links)

    def test_netplan_persistent_and_active_must_agree(self):
        config = {'network': {'ethernets': {'lan0': {'dhcp4': False, 'addresses': ['10.23.97.1/8']}}}}
        def actual(args, **kwargs):
            if args[1:3] == ['-j', 'link']:
                return json.dumps([{'ifname': 'lan0', 'address': '02:00:00:00:00:01'}])
            if 'address' in args:
                return json.dumps([{'addr_info': [{'family': 'inet', 'local': '10.23.97.1', 'prefixlen': 8}]}])
            return '[]'
        import yaml
        for saved, dhcp, wanted in (('10.23.97.1/8', False, True), ('10.23.97.1/16', False, False),
                                    ('10.23.97.1/8', True, False)):
            config['network']['ethernets']['lan0'].update(addresses=[saved], dhcp4=dhcp)
            result = subprocess.CompletedProcess([], 0, yaml.safe_dump(config), '')
            with patch.object(p, 'run', return_value=result), patch.object(p, 'output', side_effect=actual):
                self.assertEqual(p.net_check('net-interna-netplan', 'wan0', 'lan0', '192.168.236.60'), wanted)

    def packet(self):
        return {'iifname': 'lan0', 'oifname': 'wan0', 'l4proto': 'tcp', 'nfproto': 'ipv4',
                'saddr': '10.23.97.100', 'daddr': '9.9.9.9', 'state': 'new', 'sport': 12345, 'dport': 80}

    def test_nft_order_sets_and_real_hook(self):
        packet = self.packet()
        for expressions in ([meta('iifname', 'lan0'), meta('oifname', 'wan0'), {'accept': None}],
                            [meta('oifname', 'wan0'), meta('iifname', 'lan0'), {'accept': None}],
                            [meta('iifname', {'set': ['lan0', 'lan1']}), {'counter': {}}, {'accept': None}]):
            self.assertTrue(p.nft_verdict(nft_data([expressions]), 'forward', packet))
        data = nft_data([[{'accept': None}]], hook='input')
        self.assertFalse(p.nft_verdict(data, 'forward', packet))
        packet.update(iifindex=5, oifindex=6)
        for value in ('lan0', 5):
            self.assertTrue(p.nft_verdict(nft_data([[meta('iif', value), {'accept': None}]]), 'forward', packet))
        self.assertFalse(p.nft_verdict(nft_data([[meta('iif', 99), {'accept': None}]]), 'forward', packet))

    def test_nft_earlier_drop_wins(self):
        data = nft_data([[{'drop': None}], [meta('iifname', 'lan0'), {'accept': None}]])
        self.assertFalse(p.nft_verdict(data, 'forward', self.packet()))

    def test_nft_jumps_and_other_base_chains(self):
        data = nft_data([[{'jump': {'target': 'child'}}]])
        data['nftables'].extend([
            {'chain': {'family': 'inet', 'table': 'test', 'name': 'child'}},
            {'rule': {'family': 'inet', 'table': 'test', 'chain': 'child', 'expr': [{'accept': None}]}}])
        self.assertTrue(p.nft_verdict(data, 'forward', self.packet()))
        data['nftables'].append({'chain': {'family': 'inet', 'table': 'test', 'name': 'later', 'hook': 'forward', 'prio': 10, 'policy': 'drop'}})
        self.assertFalse(p.nft_verdict(data, 'forward', self.packet()))

    def test_nft_unknown_is_technical_not_fail_or_pass(self):
        data = nft_data([[{'limit': {'rate': 10}}, {'accept': None}]])
        with self.assertRaises(p.Unavailable):
            p.nft_verdict(data, 'forward', self.packet())
        data = nft_data([[meta('iifname', 'irrelevant'), {'limit': {'rate': 10}}, {'accept': None}], [{'accept': None}]])
        self.assertTrue(p.nft_verdict(data, 'forward', self.packet()))

    def test_nft_masquerade_correct_interface(self):
        for iface, expected in (('wan0', True), ('other', False)):
            data = nft_data([[meta('oifname', iface), {'masquerade': None}]], hook='postrouting', policy='accept')
            self.assertEqual(p.nft_verdict(data, 'postrouting', self.packet()), expected)

    def test_sysctl_last_assignment_and_exact_value(self):
        for text, expected in (('net.ipv4.ip_forward=1', True),
                               ('net.ipv4.ip_forward=10', False),
                               ('net.ipv4.ip_forward=1\nnet/ipv4/ip_forward=0', False),
                               ('# net.ipv4.ip_forward=1', False)):
            with patch.object(p, 'output', return_value=text), patch.object(Path, 'is_file', return_value=True):
                self.assertEqual(p.forwarding('fwd-persistent'), expected)

    def test_client_current_valid_lease_and_last_row(self):
        header = 'address,hwaddr,valid_lifetime,expire,subnet_id,state\n'
        now = int(p.time.time())
        for address, cltt, state, expected in (
                ('10.23.97.100', now, 0, True), ('10.23.99.254', now, 0, False),
                ('10.23.97.100', now-7200, 0, False), ('10.23.97.100', now, 2, False)):
            text = header + f'{address},02:00:00:00:00:01,3600,{cltt+3600},1,{state}\n'
            with patch.object(p, 'kea', return_value=tree(good_kea())), patch.object(p, 'read', return_value=text):
                self.assertEqual(p.client_lease(), expected)
        text = header + f'10.23.97.100,aa,3600,{now+3600},1,0\n10.23.97.100,aa,0,{now},1,2\n'
        with patch.object(p, 'kea', return_value=tree(good_kea())), patch.object(p, 'read', return_value=text):
            self.assertFalse(p.client_lease())

    def test_client_lfc_rotation_preserves_live_leases_and_deletions(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'leases.csv'
            header = 'address,hwaddr,valid_lifetime,expire,subnet_id,state\n'
            live = f'10.23.97.100,02:00:00:00:00:01,3600,{int(p.time.time())+3600},1,0\n'
            Path(str(path) + '.2').write_text(header + live)
            path.write_text(header)
            root = good_kea()
            root['lease-database'] = {'type': 'memfile', 'name': str(path)}
            with patch.object(p, 'kea', return_value=tree(root)):
                self.assertTrue(p.client_lease())
                path.write_text(header + '10.23.97.100,02:00:00:00:00:01,0,0,1,0\n')
                self.assertFalse(p.client_lease())
                path.write_text(header)
                Path(str(path) + '.completed').write_text(header)
                self.assertFalse(p.client_lease())

    def test_missing_tools_and_program_errors_are_technical(self):
        with patch.object(p.shutil, 'which', return_value=None):
            with self.assertRaises(p.Unavailable):
                p.run(['missing'])
            with self.assertRaises(p.Incorrect):
                p.run(['nft'], academic=True)
        for err, expected in ((PermissionError('denied'), 70), (p.Unavailable('unsupported'), 70), (p.Incorrect('bad config'), 0)):
            with patch.object(p, 'evaluate', side_effect=err):
                self.assertEqual(p.main(['kea-subxarxa', 'wan0', 'lan0', '192.168.236.60']), expected)


if __name__ == '__main__':
    unittest.main()
