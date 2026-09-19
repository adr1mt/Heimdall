group "fallos" do
  target "comando inexistente", weight: 1
  run "este_comando_no_existe_12345"
  expect_exit 0

  target "comando inexistente: buscamos texto", weight: 1
  run "este_comando_no_existe_12345"
  expect "not found"

  target "TYPO en el DSL (expct en vez de expect)", weight: 5
  run "echo ALGO"
  expct "ALGO"

  target "target correcto tras el typo", weight: 1
  run "echo OK2"
  expect "OK2"
end

play do
  show
  export format: "json"
end
