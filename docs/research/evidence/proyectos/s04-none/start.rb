group "expect_none bajo fallo" do
  target "NO debe existir el usuario 'intruso'", weight: 1
  run "cut -d: -f1 /etc/passwd", on: :host1
  expect_none "intruso"

  target "NO debe estar telnet instalado", weight: 1
  run "which telnetd || echo nada", on: :host1
  expect_none "/usr/sbin/telnetd"
end
play do
  show
  export format: "json"
end
