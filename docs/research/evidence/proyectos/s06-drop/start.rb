group "drop" do
  target "check previo ok", weight: 1
  run "echo ANTES", on: :host1
  expect "ANTES"
  target "durante este comando cortamos el contenedor", weight: 1
  run "sleep 30", on: :host1
  expect_exit 0
  target "check posterior", weight: 1
  run "echo DESPUES", on: :host1
  expect "DESPUES"
end
play do
  show
  export format: "json"
end
