group "dinamico" do
  3.times do |i|
    target "bucle #{i}", weight: 1
    run "echo L#{i}"
    expect "L#{i}"
  end
  if _nivel.to_i > 2
    target "condicional", weight: 1
    run "echo COND"
    expect "COND"
  end
end
play do
  show
  export format: "json"
end
