#!/bin/sh
set -eu
umask 077
base=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
profiles=${XDG_CONFIG_HOME:-"$HOME/.config"}/heimdall/checkers/ra1-dhcp
install_profile() {
    dir=$base/$1
    revision=$2
    (cd "$dir" && printf '%s  checker.py\n' "$revision" | sha256sum -c -)
    mkdir -p "$profiles/$revision"
    install -m 600 "$dir/criteria.json" "$dir/checker.py" "$profiles/$revision/"
}
install_profile ra1-dhcp-kea e832a93079d00ac294308ad40c3fc7cca140fbdc2d2ec6ef345a82f30fb91862
install_profile ra1-v2 cc653e10b6087ad31ce72344a361f53599376188cfef6aea560d67f2fb8f9811
