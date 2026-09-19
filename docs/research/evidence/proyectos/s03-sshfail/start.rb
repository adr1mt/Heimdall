group "fallos ssh" do
  target "conecta y comprueba algo", weight: 1
  run "whoami", on: :host1
  expect "alumno"

  target "segundo check tras el fallo", weight: 1
  run "echo SEGUNDO", on: :host1
  expect "SEGUNDO"
end
play do
  show
  export format: "json"
end
