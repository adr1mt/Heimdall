group "mem" do
  target "300MB", weight: 1
  run "yes AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA | head -c 300000000", on: :host1
  expect "AAAA"
end
play do
  show
end
