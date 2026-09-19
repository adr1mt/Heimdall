group "exitcode inconsistente" do
  target "inexistente SIN metacaracteres", weight: 1
  run "noexiste_abc"
  expect_exit 127

  target "inexistente CON metacaracter ($)", weight: 1
  run "noexiste_abc $PWD"
  expect_exit 127

  target "inexistente CON pipe", weight: 1
  run "noexiste_abc | cat"
  expect_exit 127
end
play do
  show
  export format: "json"
end
