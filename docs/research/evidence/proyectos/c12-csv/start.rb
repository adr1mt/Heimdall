group "g" do
  target "t", weight: 1
  run "echo OK"
  expect "OK"
end
play do
  show
  export format: "json"
end
