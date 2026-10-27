package plan

import (
	"os"
	"strings"
	"testing"

	"heimdall/internal/probe"
)

func TestRA1V2ExamRubric(t *testing.T) {
	exam, err := os.ReadFile("../../exams/ra1-v2/examen.yaml")
	if err != nil {
		t.Fatal(err)
	}
	if err := CheckExam("../../exams/ra1-v2/examen.yaml"); err != nil {
		t.Fatal(err)
	}
	inv, err := os.ReadFile("../../test/exams/ra1/aula.yaml")
	if err != nil {
		t.Fatal(err)
	}
	p, err := Load(project(t, string(exam), string(inv)))
	if err != nil {
		t.Fatal(err)
	}
	if p.ExamName != "RA1 v2" || p.Summary.CheckCount != 12 || p.Summary.TotalWeight != 19 {
		t.Fatalf("unexpected rubric: %s, %+v", p.ExamName, p.Summary)
	}
	kea, forwarding := 0, 0
	for _, check := range p.Students[0].Checks {
		if !check.Probe || check.Cmd[2] != probe.RevisionV2() {
			t.Fatalf("wrong checker revision: %s", check.ID)
		}
		if strings.HasPrefix(check.ID, "kea-") {
			kea++
			if check.Weight != 2 {
				t.Fatalf("Kea weight must be 2: %s", check.ID)
			}
		}
		if strings.HasPrefix(check.ID, "fwd-") {
			forwarding++
			if check.ID != "fwd-persistent" {
				t.Fatalf("only saved forwarding is requested: %s", check.ID)
			}
		}
		if strings.HasPrefix(check.ID, "nft-") || check.ID == "client-concessio" {
			t.Fatalf("unrequested criterion: %s", check.ID)
		}
	}
	if kea != 7 || forwarding != 1 {
		t.Fatalf("expected seven Kea and one forwarding checks, got %d/%d", kea, forwarding)
	}
}
