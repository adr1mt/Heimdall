group "shell semantics" do
  target "sin metacaracteres: exec directo", weight: 1
  run "echo $HOME"
  expect "/home"

  target "con metacaracteres: pasa por shell", weight: 1
  run "echo $HOME | cat"
  expect "/home"

  target "glob sin shell", weight: 1
  run "echo *"
  expect "config.yaml"

  target "INYECCION via config", weight: 1
  run "id -u #{'INTERPOLATED'}"
  expect "x"

  target "inyeccion real desde config.yaml", weight: 1
  run "echo usuario_" + _user_input.to_s
  expect "pepe"
end

play do
  show
  export format: "json"
end
