#!/bin/sh
# Inside the disposable lab container only. No classroom data or addresses.
set -eu
ip link add enp1s0 type dummy
ip link add enp2s0 type veth peer name personal-client
ip link set enp1s0 up
ip link set enp2s0 up
ip link set personal-client up
mkdir -p /etc/netplan
cat > /etc/netplan/10-wan.yaml <<'EOF'
network:
  version: 2
  renderer: networkd
  ethernets:
    enp1s0:
      dhcp4: false
      ignore-carrier: true
      addresses: [192.168.236.60/24]
      routes:
        - to: default
          via: 192.168.236.1
      nameservers:
        addresses: [192.168.236.1]
EOF
cat > /etc/netplan/20-lan.yaml <<'EOF'
network:
  version: 2
  ethernets:
    enp2s0:
      dhcp4: false
      addresses: [10.23.97.1/8]
EOF
chmod 600 /etc/netplan/*.yaml
netplan generate
systemctl start systemd-networkd systemd-resolved
networkctl reload
networkctl reconfigure enp1s0 enp2s0
cat > /etc/kea/kea-dhcp4.conf <<'EOF'
{
 "Dhcp4": {
  "interfaces-config": {"interfaces": ["enp2s0"]},
  "lease-database": {"type":"memfile", "persist":true,"name":"/var/lib/kea/kea-leases4.csv"},
  "valid-lifetime": 3600,
  "subnet4": [{"id":1,"subnet":"10.0.0.0/8",
   "pools": [{"pool":"10.23.97.100 - 10.23.98.93"}],
   "option-data": [{"name":"routers", "data":"10.23.97.1"},
                   {"name":"domain-name-servers", "data":"9.9.9.9"}],
   "reservations": [
    {"ip-address":"10.23.96.10", "hw-address":"02:27:01:10:00:01"},
    {"hw-address":"02:27:01:10:00:02", "ip-address":"10.23.96.11"},
    {"hw-address":"02:27:01:20:00:01",


     "ip-address":"10.23.96.50"},
    {"ip-address":"10.23.96.51",
     "hw-address":"02:27:01:20:00:02"}
   ]
  }]
 }
}
EOF
cat > /etc/nftables.conf <<'EOF'
#!/usr/sbin/nft -f
flush ruleset
table inet aula {
 chain forward {
  type filter hook forward priority filter; policy drop;
  oifname "enp1s0" iifname "enp2s0" counter accept
  ct state { established, related } accept
 }
}
table ip sortida {
 chain postrouting {
  type nat hook postrouting priority srcnat; policy accept;
  oifname "enp1s0" masquerade
 }
}
EOF
printf 'net.ipv4.ip_forward=1\n' > /etc/sysctl.d/90-exam.conf
sysctl -w net.ipv4.ip_forward=1
# Resolution is tested inside this isolated lab; no external DNS is contacted.
printf '\n127.0.0.1 upc.edu\n' >> /etc/hosts
systemctl enable --now nftables kea-dhcp4-server ssh
