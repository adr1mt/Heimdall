package plan

import (
	"testing"
)

// The two exams of docs/design/01-TRADUCCION-EXAMENES.md, translated to the
// format of 02-FORMATO.md. They are the reason the new primitives exist, so
// the PLAN has to resolve them whole: every check, for every student, with
// its assertion ready to evaluate.
func TestRealExamsPlanCompletely(t *testing.T) {
	cases := []struct {
		name     string
		dir      string
		checks   int
		weight   float64
		students int // evaluable
	}{
		{"E1 · cuestionario de redes", "../../testdata/cuestionario", 10, 11, 2},
		{"E2 · RA2 servicios de red", "../../testdata/formato", 10, 11, 2},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			p, err := Load(c.dir)
			if err != nil {
				t.Fatalf("Load: %v", err)
			}
			if p.Summary.CheckCount != c.checks || p.Summary.TotalWeight != c.weight {
				t.Errorf("plan = %d comprobaciones y peso %v, se esperaba %d y %v",
					p.Summary.CheckCount, p.Summary.TotalWeight, c.checks, c.weight)
			}

			evaluable := 0
			for _, s := range p.Students {
				if s.Excluded {
					continue
				}
				evaluable++
				if len(s.Checks) != c.checks {
					t.Fatalf("el alumno %q tiene %d comprobaciones y el plan %d",
						s.ID, len(s.Checks), c.checks)
				}
				for _, check := range s.Checks {
					// Every check must be ready to run: something to do, and
					// exactly one thing to compare.
					if len(check.Cmd) == 0 && check.Value == "" {
						t.Errorf("%s/%s no tiene ni comando ni valor", s.ID, check.ID)
					}
					if n := countAssertions(Check{
						Contains: check.Contains, NotContains: check.NotContains,
						Equals: check.Equals, ExitCode: check.ExitCode, Near: check.Near,
					}); n != 1 {
						t.Errorf("%s/%s tiene %d aserciones", s.ID, check.ID, n)
					}
					if containsSecretRef(check.Value) {
						t.Errorf("%s/%s lleva una referencia sin sustituir", s.ID, check.ID)
					}
				}
			}
			if evaluable != c.students {
				t.Errorf("alumnos evaluables = %d, se esperaba %d", evaluable, c.students)
			}
		})
	}
}

// The questionnaire is the one that proves the new primitive: ten checks and
// not a single command, anywhere.
func TestQuestionnaireRunsNoCommands(t *testing.T) {
	p, err := Load("../../testdata/cuestionario")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	for _, s := range p.Students {
		for _, check := range s.Checks {
			if len(check.Cmd) > 0 {
				t.Errorf("%s/%s ejecuta %v", s.ID, check.ID, check.Cmd)
			}
			if check.Host != "" || check.Target.IP != "" {
				t.Errorf("%s/%s apunta a una máquina: %q %q", s.ID, check.ID, check.Host, check.Target.IP)
			}
		}
	}
}

// Each student answers the questionnaire with their own values, and that is
// the only thing that changes between them.
func TestQuestionnaireSubstitutesEachStudentsAnswers(t *testing.T) {
	p, err := Load("../../testdata/cuestionario")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	got := map[string]string{}
	for _, s := range p.Students {
		for _, check := range s.Checks {
			if check.ID == "p2" {
				got[s.ID] = check.Value
			}
		}
	}
	want := map[string]string{"alumne01": "22", "alumne02": "23"}
	for id, value := range want {
		if got[id] != value {
			t.Errorf("la respuesta p2 de %s es %q, se esperaba %q", id, got[id], value)
		}
	}
}
