group "scale" do
  target "c1", weight: 1
  run "whoami", on: :host1
  expect "alumno"
  target "c2", weight: 1
  run "sleep 1; echo OK", on: :host1
  expect "OK"
  target "c3", weight: 1
  run "uname -s", on: :host1
  expect "Linux"
end
play do
  show
  export format: "json"
end
