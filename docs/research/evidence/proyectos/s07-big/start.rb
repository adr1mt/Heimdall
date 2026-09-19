group "salida grande" do
  target "100k lineas (~1.2MB) por SSH", weight: 1
  run "seq 1 100000", on: :host1
  expect "99999"
  target "50MB por SSH", weight: 1
  run "head -c 50000000 /dev/zero | tr '\\0' 'A' | fold -w 100", on: :host1
  expect "AAAA"
end
play do
  show
  export format: "json"
end
