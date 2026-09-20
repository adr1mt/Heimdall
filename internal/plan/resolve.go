package plan

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"time"

	"evalon/internal/model"
)

// File names of a project directory. Two files, as the editor of the GUI
// expects (K-12).
const (
	ExamFile      = "examen.yaml"
	InventoryFile = "aula.yaml"
)

// DefaultConcurrency is the size of the worker pool of the prototype. It is
// published in the PLAN so the artifact says under which conditions the run
// happened.
const DefaultConcurrency = 2

// Connection timeouts used when the inventory says nothing.
const (
	DefaultConnectTimeout = Duration(10 * time.Second)
	DefaultStudentBudget  = Duration(10 * time.Minute)
)

// Plan is exam × inventory resolved into a fixed, numbered list of checks. It
// is built before the first connection and never changes afterwards
// (ADR-0002): every student has the same ids, the same order and the same
// weights, which is what makes the denominator fair (ADR-0004).
type Plan struct {
	ExamName      string
	InventoryName string

	Exam      model.SourceRef
	Inventory model.SourceRef
	Hash      string // sha256 of the resolved plan
	Summary   model.PlanSummary

	ConnectTimeout time.Duration
	StudentBudget  time.Duration

	Students []StudentPlan
}

// StudentPlan is the work of one student. Excluded students are in the list
// with no checks: they appear in the report and they do not move anybody
// else's denominator.
type StudentPlan struct {
	ID       string
	Name     string
	MoodleID string
	Excluded bool
	Checks   []ResolvedCheck
}

// ResolvedCheck is one check of one student, with every ${...} already
// replaced. What varies between students is only the arguments, the host and
// the expected value; never the id, the weight or the order.
type ResolvedCheck struct {
	ID          string
	Group       string
	Description string
	Weight      float64
	Timeout     time.Duration

	Host   string // logical host, empty for a check without a command
	Target Host   // where to connect, empty for a check without a command

	Cmd   []string
	Value string

	Contains    *string
	NotContains *string
	Equals      *string
	ExitCode    *int
	Near        *NearSpec
}

// Load reads a project directory and resolves the PLAN. Every error it
// returns is a configuration error: the caller exits with code 2 and does not
// touch a single machine.
func Load(dir string) (*Plan, error) {
	examPath := filepath.Join(dir, ExamFile)
	inventoryPath := filepath.Join(dir, InventoryFile)

	exam, err := LoadExam(examPath)
	if err != nil {
		return nil, err
	}
	inventory, err := LoadInventory(inventoryPath)
	if err != nil {
		return nil, err
	}
	return Resolve(exam, inventory, examPath, inventoryPath)
}

// Resolve applies the nine validations of docs/design/02-FORMATO.md §5 and
// builds the plan. It reports every problem it finds, sorted by line: a file
// with three mistakes is fixed in one sitting.
func Resolve(exam *Exam, inventory *Inventory, examPath, inventoryPath string) (*Plan, error) {
	var examErrs, inventoryErrs []error

	checks := validateExam(exam, &examErrs)
	validateInventory(inventory, &inventoryErrs)

	if err := join(examErrs); err != nil {
		return nil, withFile(examPath, err)
	}
	if err := join(inventoryErrs); err != nil {
		return nil, withFile(inventoryPath, err)
	}

	students, err := resolveStudents(exam, inventory, checks, examPath, inventoryPath)
	if err != nil {
		return nil, err
	}

	examRef, err := sourceRef(examPath, exam.Version)
	if err != nil {
		return nil, err
	}
	inventoryRef, err := sourceRef(inventoryPath, inventory.Version)
	if err != nil {
		return nil, err
	}

	plan := &Plan{
		ExamName:       exam.Name,
		InventoryName:  inventory.Name,
		Exam:           examRef,
		Inventory:      inventoryRef,
		ConnectTimeout: durationOr(inventory.Common.Timeouts.Connect, DefaultConnectTimeout),
		StudentBudget:  durationOr(inventory.Common.Timeouts.Student, DefaultStudentBudget),
		Students:       students,
		Summary: model.PlanSummary{
			CheckCount:  len(checks),
			TotalWeight: totalWeight(checks),
			CheckIDs:    checkIDs(checks),
			Concurrency: DefaultConcurrency,
		},
	}
	plan.Hash = hashPlan(plan)
	return plan, nil
}

// validateExam checks what does not depend on any student and returns the
// checks in order.
func validateExam(exam *Exam, errs *[]error) []Check {
	declared := map[string]bool{}
	for _, h := range exam.Hosts {
		declared[h] = true
	}

	var checks []Check
	seen := map[string]int{}

	for _, group := range exam.Groups {
		for _, check := range group.Checks {
			checks = append(checks, check)

			// 2. id duplicated or missing.
			switch {
			case check.ID == "":
				*errs = append(*errs, errf(check.Line, "la comprobación no tiene id"))
			default:
				if first, dup := seen[check.ID]; dup {
					*errs = append(*errs, errf(check.Line,
						"id %q repetido: ya se usa en la línea %d", check.ID, first))
				}
				seen[check.ID] = check.Line
			}

			// 7. negative weight. Zero is legal and reported without grade.
			if check.Weight != nil && *check.Weight < 0 {
				*errs = append(*errs, errf(check.Line,
					"peso negativo (%v) en %q", *check.Weight, check.ID))
			}

			// 3. logical host used but not declared. A check without a
			// command runs nowhere and needs no host.
			hasCmd := len(check.Cmd) > 0
			switch {
			case hasCmd && check.Value != "":
				*errs = append(*errs, errf(check.Line,
					"la comprobación %q tiene cmd: y valor:, y solo puede tener uno", check.ID))
			case hasCmd && check.On == "":
				*errs = append(*errs, errf(check.Line,
					"la comprobación %q no dice en qué host se ejecuta", check.ID))
			case hasCmd && !declared[check.On]:
				*errs = append(*errs, errf(check.Line,
					"la comprobación %q usa el host %q, que no está declarado en hosts:",
					check.ID, check.On))
			case !hasCmd && check.Value == "":
				*errs = append(*errs, errf(check.Line,
					"la comprobación %q no tiene ni cmd: ni valor:", check.ID))
			case !hasCmd && check.On != "":
				*errs = append(*errs, errf(check.Line,
					"la comprobación %q no tiene cmd:, así que no puede decir en qué host se ejecuta",
					check.ID))
			}

			// 6. no assertion, or more than one.
			switch n := countAssertions(check); {
			case n == 0:
				*errs = append(*errs, errf(check.Line,
					"la comprobación %q no comprueba nada: le falta la aserción", check.ID))
			case n > 1:
				*errs = append(*errs, errf(check.Line,
					"la comprobación %q tiene %d aserciones y solo puede tener una", check.ID, n))
			}
		}
	}

	if len(checks) == 0 {
		*errs = append(*errs, errf(1, "el examen no tiene ninguna comprobación"))
	}
	return checks
}

func countAssertions(c Check) int {
	n := 0
	for _, present := range []bool{
		c.Contains != nil, c.NotContains != nil, c.Equals != nil,
		c.ExitCode != nil, c.Near != nil,
	} {
		if present {
			n++
		}
	}
	return n
}

func validateInventory(inv *Inventory, errs *[]error) {
	evaluable := 0
	seen := map[string]int{}

	for _, student := range inv.Students {
		if student.ID == "" {
			*errs = append(*errs, errf(student.Line, "el alumno no tiene id"))
		} else if first, dup := seen[student.ID]; dup {
			*errs = append(*errs, errf(student.Line,
				"id de alumno %q repetido: ya se usa en la línea %d", student.ID, first))
		} else {
			seen[student.ID] = student.Line
		}
		if !student.Excluded {
			evaluable++
		}
		// A secret reference outside an authentication field would be
		// substituted into a command and would come back out in the result.
		// The whole guarantee of security.md §1.4 rests on rejecting it here.
		for field, value := range student.Fields {
			if containsSecretRef(value) {
				*errs = append(*errs, errf(student.Line,
					"el campo %q del alumno %q usa una referencia a un secreto: "+
						"solo valen en password_ref y passphrase_ref",
					field, student.ID))
			}
		}

		// 8. a literal password is an error, not a warning.
		for name, host := range student.Hosts {
			if containsSecretRef(host.IP) || containsSecretRef(host.User) {
				*errs = append(*errs, errf(student.Line,
					"el host %q del alumno %q usa una referencia a un secreto fuera de "+
						"password_ref", name, student.ID))
			}
			if host.Password != "" {
				*errs = append(*errs, errf(student.Line,
					"el host %q del alumno %q lleva una contraseña escrita en el fichero: "+
						"usa password_ref con una referencia como ${AULA_PASSWORD}",
					name, student.ID))
			}
		}
	}

	for name, host := range inv.Common.Hosts {
		if containsSecretRef(host.IP) || containsSecretRef(host.User) {
			*errs = append(*errs, errf(1,
				"el host %q de comun: usa una referencia a un secreto fuera de password_ref", name))
		}
		if host.Password != "" {
			*errs = append(*errs, errf(1,
				"el host %q de comun: lleva una contraseña escrita en el fichero: "+
					"usa password_ref con una referencia como ${AULA_PASSWORD}", name))
		}
	}

	// 9. an inventory with nobody to evaluate is a mistake, not an empty run.
	if evaluable == 0 {
		*errs = append(*errs, errf(1, "el aula no tiene ningún alumno evaluable"))
	}
}

// resolveStudents substitutes every reference for every student. A reference
// that fails for one single student stops the whole run: the alternative is a
// student silently examined on something else (ADR-0004).
func resolveStudents(exam *Exam, inv *Inventory, checks []Check, examPath, inventoryPath string) ([]StudentPlan, error) {
	var errs []error
	plans := make([]StudentPlan, 0, len(inv.Students))

	for _, student := range inv.Students {
		sp := StudentPlan{
			ID:       student.ID,
			Name:     student.Name,
			MoodleID: student.MoodleID,
			Excluded: student.Excluded,
		}
		if student.Excluded {
			plans = append(plans, sp)
			continue
		}

		// 4. a host the exam declares must have data for every student.
		for _, name := range exam.Hosts {
			host, ok := student.Hosts[name]
			if !ok || host.IP == "" {
				errs = append(errs, withFile(inventoryPath, errf(student.Line,
					"el alumno %q no tiene la ip del host %q, que el examen usa",
					student.ID, name)))
			}
		}

		sc := scope{studentID: student.ID, fields: studentFields(student), hosts: student.Hosts}
		for _, check := range checks {
			resolved, err := resolveCheck(check, sc, exam)
			if err != nil {
				errs = append(errs, withFile(examPath, errf(check.Line, "%s", err)))
				continue
			}
			sp.Checks = append(sp.Checks, resolved)
		}
		plans = append(plans, sp)
	}
	return plans, join(errs)
}

// studentFields is what ${alumno.X} can see: the free fields the teacher
// wrote plus the student's own identity. A field written by some students and
// not by others is caught here, because the lookup fails for the one who
// lacks it (rule 4 of §2).
func studentFields(s Student) map[string]string {
	fields := make(map[string]string, len(s.Fields)+3)
	for k, v := range s.Fields {
		fields[k] = v
	}
	for k, v := range map[string]string{"id": s.ID, "nombre": s.Name, "moodle_id": s.MoodleID} {
		if v != "" {
			fields[k] = v
		}
	}
	return fields
}

func resolveCheck(check Check, sc scope, exam *Exam) (ResolvedCheck, error) {
	out := ResolvedCheck{
		ID:          check.ID,
		Description: check.Description,
		Weight:      *check.Weight,
		Timeout:     time.Duration(*check.Timeout),
		Host:        check.On,
		ExitCode:    check.ExitCode,
	}
	out.Group = groupOf(exam, check.ID)
	if check.On != "" {
		out.Target = sc.hosts[check.On]
	}

	for _, arg := range check.Cmd {
		value, err := substitute(arg, sc)
		if err != nil {
			return ResolvedCheck{}, err
		}
		out.Cmd = append(out.Cmd, value)
	}

	var err error
	if out.Value, err = substitute(check.Value, sc); err != nil {
		return ResolvedCheck{}, err
	}
	if out.Contains, err = substitutePtr(check.Contains, sc); err != nil {
		return ResolvedCheck{}, err
	}
	if out.NotContains, err = substitutePtr(check.NotContains, sc); err != nil {
		return ResolvedCheck{}, err
	}
	if out.Equals, err = substitutePtr(check.Equals, sc); err != nil {
		return ResolvedCheck{}, err
	}
	if check.Near != nil {
		near := *check.Near
		if near.Anchor, err = substitute(near.Anchor, sc); err != nil {
			return ResolvedCheck{}, err
		}
		if near.Contains, err = substitute(near.Contains, sc); err != nil {
			return ResolvedCheck{}, err
		}
		out.Near = &near
	}
	return out, nil
}

func substitutePtr(in *string, sc scope) (*string, error) {
	if in == nil {
		return nil, nil
	}
	value, err := substitute(*in, sc)
	if err != nil {
		return nil, err
	}
	return &value, nil
}

func groupOf(exam *Exam, id string) string {
	for _, group := range exam.Groups {
		for _, check := range group.Checks {
			if check.ID == id {
				return group.Name
			}
		}
	}
	return ""
}

func totalWeight(checks []Check) float64 {
	total := 0.0
	for _, c := range checks {
		total += *c.Weight
	}
	return total
}

func checkIDs(checks []Check) []string {
	ids := make([]string, 0, len(checks))
	for _, c := range checks {
		ids = append(ids, c.ID)
	}
	return ids
}

func durationOr(d *Duration, fallback Duration) time.Duration {
	if d != nil {
		return time.Duration(*d)
	}
	return time.Duration(fallback)
}

func sourceRef(path string, version int) (model.SourceRef, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return model.SourceRef{}, fmt.Errorf("no se puede leer %s: %w", path, err)
	}
	sum := sha256.Sum256(data)
	return model.SourceRef{
		Path:    path,
		SHA256:  hex.EncodeToString(sum[:]),
		Version: strconv.Itoa(version),
	}, nil
}

// hashPlan fingerprints the resolved plan: the ids, the weights, the order and
// what every student is actually going to be asked. Two runs with the same
// hash asked the same questions. It carries password_ref, which is a
// reference, and never a secret value.
func hashPlan(p *Plan) string {
	type hashedCheck struct {
		ID       string   `json:"id"`
		Group    string   `json:"group"`
		Weight   float64  `json:"weight"`
		Timeout  string   `json:"timeout"`
		Host     string   `json:"host"`
		Address  string   `json:"address"`
		User     string   `json:"user"`
		Cmd      []string `json:"cmd"`
		Value    string   `json:"value"`
		Assert   string   `json:"assert"`
		Expected string   `json:"expected"`
	}
	type hashedStudent struct {
		ID       string        `json:"id"`
		Excluded bool          `json:"excluded"`
		Checks   []hashedCheck `json:"checks"`
	}
	type hashedPlan struct {
		Exam      string          `json:"exam"`
		Inventory string          `json:"inventory"`
		Total     float64         `json:"total_weight"`
		Students  []hashedStudent `json:"students"`
	}

	doc := hashedPlan{
		Exam:      p.Exam.SHA256,
		Inventory: p.Inventory.SHA256,
		Total:     p.Summary.TotalWeight,
	}
	for _, s := range p.Students {
		hs := hashedStudent{ID: s.ID, Excluded: s.Excluded}
		for _, c := range s.Checks {
			kind, expected := assertionOf(c)
			hs.Checks = append(hs.Checks, hashedCheck{
				ID: c.ID, Group: c.Group, Weight: c.Weight,
				Timeout: c.Timeout.String(),
				Host:    c.Host,
				Address: fmt.Sprintf("%s:%d", c.Target.IP, c.Target.Port),
				User:    c.Target.User,
				Cmd:     c.Cmd, Value: c.Value,
				Assert: kind, Expected: expected,
			})
		}
		doc.Students = append(doc.Students, hs)
	}
	sort.Slice(doc.Students, func(i, j int) bool { return doc.Students[i].ID < doc.Students[j].ID })

	data, err := json.Marshal(doc)
	if err != nil { // the document is made of strings and numbers only
		return ""
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// assertionOf names the single assertion of a check and its expected value.
func assertionOf(c ResolvedCheck) (string, string) {
	switch {
	case c.Contains != nil:
		return "contiene", *c.Contains
	case c.NotContains != nil:
		return "no_contiene", *c.NotContains
	case c.Equals != nil:
		return "igual_a", *c.Equals
	case c.ExitCode != nil:
		return "exit_code", strconv.Itoa(*c.ExitCode)
	case c.Near != nil:
		return "cerca_de", fmt.Sprintf("%s|%d|%s", c.Near.Anchor, c.Near.Lines, c.Near.Contains)
	default:
		return "", ""
	}
}
