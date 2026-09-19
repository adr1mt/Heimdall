group "g" do
  target "marca de la ejecucion", weight: 1
  run "sleep 2; echo MARCA", on: :host1
  expect "MARCA"
end
play do
  show
  export format: "json"
end
