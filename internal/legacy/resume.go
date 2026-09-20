package legacy

import "heimdall/internal/model"

// resume is var/<testname>/resume.json (C6): the one file that carries the
// grade, the student and the technical state of their machines.
type resume struct {
	Config     resumeConfig      `json:"config"`
	Cases      []resumeCase      `json:"cases"`
	Results    resumeResults     `json:"results"`
	HallOfFame map[string]string `json:"hall_of_fame"`
}

// resumeConfig carries only the three keys the GUI reads. Teuton dumped the
// whole configuration here, credentials included; this does not.
type resumeConfig struct {
	TestName string `json:"tt_testname"`
	Title    string `json:"tt_title"`
	Sequence bool   `json:"tt_sequence"`
}

type resumeCase struct {
	Skip       bool              `json:"skip"`
	ID         string            `json:"id"`
	Letter     string            `json:"letter"`
	Grade      float64           `json:"grade"`
	Members    string            `json:"members"`
	ConnStatus map[string]string `json:"conn_status"`
	MoodleID   string            `json:"moodle_id"`
}

type resumeResults struct {
	StartTime  string  `json:"start_time"`
	FinishTime string  `json:"finish_time"`
	Duration   float64 `json:"duration"`
}

func (w *Writer) resume(run *model.RunResult) resume {
	cases := make([]resumeCase, 0, len(run.Students))
	for i, s := range run.Students {
		skip := s.Status == model.StudentExcluded
		grade := legacyGrade(s.Score)
		conn := map[string]string{}
		if !skip {
			conn = connStatus(s)
		}
		cases = append(cases, resumeCase{
			Skip:       skip,
			ID:         caseID(i),
			Letter:     letter(skip, grade),
			Grade:      grade,
			Members:    s.Name,
			ConnStatus: conn,
			MoodleID:   s.MoodleID,
		})
	}
	return resume{
		Config: resumeConfig{TestName: w.testName, Title: w.testName},
		Cases:  cases,
		Results: resumeResults{
			StartTime:  formatTime(run.StartedAt),
			FinishTime: formatTime(run.FinishedAt),
			Duration:   round2(run.FinishedAt.Sub(run.StartedAt).Seconds()),
		},
		HallOfFame: map[string]string{},
	}
}
