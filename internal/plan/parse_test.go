package plan

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"
)

// The two files of docs/design/02-FORMATO.md live in the repository-root
// testdata/, which is reserved for exams and inventories. The malformed
// fixtures are parser material and live next to the package.
const (
	examplePath   = "../../testdata/formato/examen.yaml"
	inventoryPath = "../../testdata/formato/aula.yaml"
)

func s(v string) *string   { return &v }
func f(v float64) *float64 { return &v }
func i(v int) *int         { return &v }
func d(v time.Duration) *Duration {
	dur := Duration(v)
	return &dur
}

func TestParseExamExample(t *testing.T) {
	got, err := LoadExam(examplePath)
	if err != nil {
		t.Fatalf("LoadExam: %v", err)
	}

	want := &Exam{
		Name:     "SMX2C · RA2 · Servicios de red (KEA + BIND)",
		Version:  3,
		Hosts:    []string{"host1"},
		Defaults: Defaults{Weight: f(1), Timeout: d(20 * time.Second)},
		Groups: []Group{
			{
				Name: "Red y DHCP",
				Checks: []Check{
					{
						ID: "red-ip-servidor", On: "host1",
						Description: "El servidor tiene 10.0.0.1/8 en enp2s0",
						Weight:      f(1), Timeout: d(20 * time.Second),
						Cmd:      []string{"ip", "address", "show", "dev", "enp2s0"},
						Contains: s("10.0.0.1/8"),
					},
					{
						ID: "kea-subnet", On: "host1",
						Description: "KEA declara la subred 10.0.0.0/8",
						Weight:      f(1), Timeout: d(20 * time.Second),
						Cmd:  []string{"cat", "/etc/kea/kea-dhcp4.conf"},
						Near: &NearSpec{Anchor: `"subnet"`, Lines: 5, Contains: "10.0.0.0/8"},
					},
					{
						ID: "kea-interfaz", On: "host1",
						Description: "KEA escucha en enp2s0",
						Weight:      f(1), Timeout: d(20 * time.Second),
						Cmd:      []string{"cat", "/etc/kea/kea-dhcp4.conf"},
						Contains: s("enp2s0"),
					},
					{
						ID: "kea-servicio", On: "host1",
						Description: "El servicio kea-dhcp4 está activo",
						Weight:      f(2), Timeout: d(20 * time.Second),
						Cmd:    []string{"systemctl", "is-active", "kea-dhcp4-server"},
						Equals: s("active"),
					},
				},
			},
			{
				Name: "DNS",
				Checks: []Check{
					{
						ID: "dns-forwarder", On: "host1",
						Description: "Reenviador 9.9.9.9 configurado",
						Weight:      f(1), Timeout: d(20 * time.Second),
						Cmd:  []string{"cat", "/etc/bind/named.conf.options"},
						Near: &NearSpec{Anchor: "forwarders", Lines: 5, Contains: "9.9.9.9"},
					},
					{
						ID: "dns-registro-alumno", On: "host1",
						Description: "El alumno tiene su registro A en la zona directa",
						Weight:      f(1), Timeout: d(20 * time.Second),
						Cmd:      []string{"cat", "/etc/bind/forward.examen.local"},
						Contains: s("${alumno.subdominio}"),
					},
					{
						ID: "dns-sin-recursion-abierta", On: "host1",
						Description: "No se permite recursión desde cualquier origen",
						Weight:      f(1), Timeout: d(20 * time.Second),
						Cmd:         []string{"cat", "/etc/bind/named.conf.options"},
						NotContains: s("allow-recursion { any; }"),
					},
					{
						ID: "dns-activo", On: "host1",
						Description: "named responde",
						Weight:      f(1), Timeout: d(10 * time.Second),
						Cmd:    []string{"dig", "+short", "+time=3", "@127.0.0.1", "pc1.examen.local"},
						Equals: s("10.1.1.100"),
					},
				},
			},
			{
				Name: "Cuestionario",
				Checks: []Check{
					{
						ID:          "q-puerto-https",
						Description: "Puerto por defecto de HTTPS",
						Weight:      f(1), Timeout: d(20 * time.Second),
						Value:  "${alumno.p1}",
						Equals: s("443"),
					},
					{
						ID:          "q-mascara-24",
						Description: "Máscara /24 en decimal",
						Weight:      f(1), Timeout: d(20 * time.Second),
						Value:  "${alumno.p3}",
						Equals: s("255.255.255.0"),
					},
				},
			},
		},
	}

	if !reflect.DeepEqual(want, got) {
		t.Errorf("el examen del diseño no se parsea sin pérdidas\nquiero: %s\ntengo:  %s", dump(want), dump(got))
	}
}

// The weight of the design example is 11 and it is known before any machine is
// touched (principle 6).
func TestExamTotalWeightIsKnownAfterParsing(t *testing.T) {
	exam, err := LoadExam(examplePath)
	if err != nil {
		t.Fatalf("LoadExam: %v", err)
	}
	total := 0.0
	count := 0
	for _, g := range exam.Groups {
		for _, c := range g.Checks {
			total += *c.Weight
			count++
		}
	}
	if count != 10 || total != 11 {
		t.Errorf("checks=%d peso=%v, se esperaba 10 y 11", count, total)
	}
}

func TestParseInventoryExample(t *testing.T) {
	got, err := LoadInventory(inventoryPath)
	if err != nil {
		t.Fatalf("LoadInventory: %v", err)
	}

	common := Host{Port: 22, User: "usuario", PasswordRef: "${AULA_PASSWORD}"}
	want := &Inventory{
		Name:    "SMX2C 2026-27",
		Version: 2,
		Common: Common{
			Hosts:    map[string]Host{"host1": common},
			Timeouts: Timeouts{Connect: d(10 * time.Second), Student: d(10 * time.Minute)},
		},
		Students: []Student{
			{
				ID: "alumne01", Name: "Ana Ferrer", MoodleID: "ana.ferrer@elpuig.xeill.net",
				Line:  16,
				Hosts: map[string]Host{"host1": {IP: "192.168.1.20", Port: 22, User: "usuario", PasswordRef: "${AULA_PASSWORD}"}},
				Fields: map[string]string{
					"subdominio": "ana", "p1": "443", "p3": "255.255.255.0",
				},
			},
			{
				ID: "alumne02", Name: "Marc Oliva", MoodleID: "marc.oliva@elpuig.xeill.net",
				Line:  25,
				Hosts: map[string]Host{"host1": {IP: "192.168.1.21", Port: 22, User: "marc", PasswordRef: "${AULA_PASSWORD}"}},
				Fields: map[string]string{
					"subdominio": "marc", "p1": "8443", "p3": "255.255.255.0",
				},
			},
			{
				ID: "alumne03", Name: "Laia Puig", MoodleID: "laia.puig@elpuig.xeill.net",
				Excluded: true, Line: 34,
				Hosts: map[string]Host{"host1": {IP: "192.168.1.22", Port: 22, User: "usuario", PasswordRef: "${AULA_PASSWORD}"}},
				Fields: map[string]string{
					"subdominio": "laia", "p1": "443", "p3": "255.255.255.0",
				},
			},
		},
	}

	if !reflect.DeepEqual(want, got) {
		t.Errorf("el aula del diseño no se parsea sin pérdidas\nquiero: %s\ntengo:  %s", dump(want), dump(got))
	}
}

// A student who redefines a field of a common host keeps the rest of it: the
// point of comun is that the teacher writes the port and the user once.
func TestInventoryInheritanceIsFieldByField(t *testing.T) {
	inv, err := LoadInventory(inventoryPath)
	if err != nil {
		t.Fatalf("LoadInventory: %v", err)
	}
	marc := inv.Students[1].Hosts["host1"]
	if marc.User != "marc" {
		t.Errorf("usuario = %q, el del alumno debe ganar", marc.User)
	}
	if marc.Port != 22 || marc.PasswordRef != "${AULA_PASSWORD}" {
		t.Errorf("host = %+v, lo que el alumno no redefine viene de comun", marc)
	}
}

// por_defecto fills what the check omits and never overrides what it says.
func TestExamDefaults(t *testing.T) {
	exam, err := LoadExam("testdata/examen-sin-por-defecto.yaml")
	if err != nil {
		t.Fatalf("LoadExam: %v", err)
	}
	inherited := exam.Groups[0].Checks[0]
	if *inherited.Weight != DefaultWeight || *inherited.Timeout != DefaultTimeout {
		t.Errorf("sin por_defecto: peso=%v timeout=%v, se esperaba %v y %v",
			*inherited.Weight, inherited.Timeout, DefaultWeight, DefaultTimeout)
	}
	own := exam.Groups[0].Checks[1]
	if *own.Weight != 3 || *own.Timeout != Duration(5*time.Second) {
		t.Errorf("con valores propios: peso=%v timeout=%v", *own.Weight, own.Timeout)
	}
}

// Every rejection carries the file and the line: the teacher does not read Go.
func TestParseRejects(t *testing.T) {
	cases := []struct {
		name    string
		file    string
		exam    bool
		line    int
		message string
	}{
		{"clave desconocida en el examen", "testdata/examen-clave-desconocida.yaml", true, 10, `clave desconocida "peligro"`},
		{"timeout mal formado en el examen", "testdata/examen-timeout-invalido.yaml", true, 10, "duración inválida"},
		{"clave desconocida en el aula", "testdata/aula-clave-desconocida.yaml", false, 10, `clave desconocida "protocolo"`},
		{"campo libre compuesto", "testdata/aula-campo-libre-compuesto.yaml", false, 10, "valor simple"},
		{"timeout mal formado en el aula", "testdata/aula-timeout-invalido.yaml", false, 5, "duración inválida"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var err error
			if tc.exam {
				_, err = LoadExam(tc.file)
			} else {
				_, err = LoadInventory(tc.file)
			}
			if err == nil {
				t.Fatal("se aceptó un fichero que debe rechazarse")
			}
			got := err.Error()
			if !strings.Contains(got, tc.message) {
				t.Errorf("error %q, se esperaba que contuviera %q", got, tc.message)
			}
			want := tc.file + ":" + itoa(tc.line)
			if !strings.Contains(got, want) {
				t.Errorf("error %q, se esperaba fichero y línea %q", got, want)
			}
		})
	}
}

// One run must show every unknown key of the file, at the top level, inside a
// list item and inside an inline mapping alike: the teacher fixes the file
// once instead of three times.
func TestParseReportsEveryUnknownKeyAtOnce(t *testing.T) {
	_, err := LoadExam("testdata/examen-varias-claves-desconocidas.yaml")
	if err == nil {
		t.Fatal("se aceptó un fichero con tres claves desconocidas")
	}
	got := err.Error()
	for _, want := range []string{`:2: clave desconocida "autor"`, `:7: clave desconocida "orden"`, `:13: clave desconocida "extra"`} {
		if !strings.Contains(got, want) {
			t.Errorf("error %q, falta %q", got, want)
		}
	}
}

// Nothing in this package may touch the network or the clock; it also must not
// swallow a bad file. A missing file is an error, never an empty exam.
func TestMissingFileIsAnError(t *testing.T) {
	if _, err := LoadExam("testdata/no-existe.yaml"); err == nil {
		t.Fatal("un fichero inexistente debe ser error")
	}
}

// dump renders a value for a failure message; the structs are full of
// pointers and %+v would only print addresses.
func dump(v any) string {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return "<no serializable>"
	}
	return string(b)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b []byte
	for n > 0 {
		b = append([]byte{byte('0' + n%10)}, b...)
		n /= 10
	}
	return string(b)
}
