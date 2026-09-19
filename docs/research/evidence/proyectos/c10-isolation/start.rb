group "g" do
  target "ok1", weight: 1
  run "echo A"
  expect "A"

  target "boom solo para uno", weight: 1
  raise "EXPLOTA_SOLO_UNO" if _tt_members.to_s.include?("BOOM")
  run "echo B"
  expect "B"

  target "ok2", weight: 1
  run "echo C"
  expect "C"
end
play do
  show
  export format: "json"
end
