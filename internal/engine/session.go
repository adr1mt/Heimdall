package engine

// The execution half of the exam session (ADR-0020 §4, T063): a student the
// session already finished is left out of the next round.
//
// Leaving them out is a decision of execution, never of grade. Their grade is
// the one the session already gave them, it is computed by BuildSession from
// the rounds that did evaluate them, and nothing here touches it. What this
// changes is only *who* the next round dials.

import (
	"fmt"

	"heimdall/internal/model"
	"heimdall/internal/plan"
)

// ExcludeFinished leaves out of this round the students the session already
// finished, and says how many are left to correct.
//
// It does not touch check_ids, weights or total_weight: the denominator is the
// PLAN's and it is the same for everybody and for every round of the session
// (ADR-0004, principios 6 y 7). Neither does it touch the PLAN's hash, which
// was fixed when the PLAN was resolved: a round that corrected fewer students
// is still a round of the same exam.
//
// A session built on another PLAN is a configuration error, and it is caught
// here, before the first connection.
func ExcludeFinished(p *plan.Plan, session *model.Session) (int, error) {
	if session.PlanHash != p.Hash {
		return 0, fmt.Errorf(
			"las vueltas de la sesión se hicieron con otro examen o con otra aula; " +
				"no son vueltas de este examen y no dicen quién ha terminado")
	}

	finished := map[string]int{}
	for _, s := range session.Students {
		if s.Status == model.SessionFinished {
			finished[s.StudentID] = s.FromRound
		}
	}

	left := 0
	for i := range p.Students {
		if p.Students[i].Excluded {
			continue
		}
		round, done := finished[p.Students[i].ID]
		if !done {
			left++
			continue
		}
		p.Students[i].Excluded = true
		p.Students[i].ExcludedReason = fmt.Sprintf(
			"en la vuelta %d de la sesión ya tenía el examen entero bien; "+
				"esta vuelta no lo corrige y su nota sigue siendo la de aquella vuelta", round)
	}
	return left, nil
}
