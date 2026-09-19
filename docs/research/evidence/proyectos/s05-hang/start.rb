group "hang" do
  target "comando que no termina nunca", weight: 1
  run "sleep 100000", on: :host1
  expect_exit 0
  target "esto no se llegara a ejecutar", weight: 1
  run "echo DESPUES", on: :host1
  expect "DESPUES"
end
play do
  show
  export format: "json"
end
