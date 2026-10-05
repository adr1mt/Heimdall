package plan

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"heimdall/internal/model"
)

// File names of a project directory. Two files, as the editor of the GUI
// expects (K-12).
const (
	ExamFile      = "examen.yaml"
	InventoryFile = "aula.yaml"
)

// DefaultConcurrency is the size of the worker pool and DefaultHostConcurrency
// the number of sessions that may be opened at the same time against one
// destination machine. Both are published in the PLAN so the artifact says
// under which conditions the run happened (ADR-0012).
//
// 16 is measured, not guessed: a class of 30 students on their own machines
// takes 24,7 s at 8 and 13,4 s at 16, for 1 MB more memory (ADR-0013).
const (
	DefaultConcurrency     = 16
	DefaultHostConcurrency = 4
)

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

	// ExcludedReason is why this student is left out, when it is not the
	// inventory that left them out. It is carried to the artifact as it is:
	// it is read by the teacher, not by the engine.
	ExcludedReason string
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

	File  string // resolved literal path, empty for existing sources
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
	return LoadNamed(dir, "")
}

// LoadNamed resolves the PLAN reading the inventory from another file of the
// same directory. It is what the GUI's --cname selects: one exam, several
// classrooms. An empty name means aula.yaml. The name is a file name, never a
// path: a separator in it is a configuration error.
func LoadNamed(dir, inventoryName string) (*Plan, error) {
	inventoryFile := InventoryFile
	if inventoryName != "" {
		if strings.ContainsAny(inventoryName, `/\`) || inventoryName == "." || inventoryName == ".." {
			return nil, fmt.Errorf("el nombre del aula %q no es un nombre de fichero", inventoryName)
		}
		inventoryFile = inventoryName
		if filepath.Ext(inventoryFile) == "" {
			inventoryFile += ".yaml"
		}
	}
	examPath := filepath.Join(dir, ExamFile)
	inventoryPath := filepath.Join(dir, inventoryFile)

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
	if weight := totalWeight(checks); math.IsNaN(weight) || math.IsInf(weight, 0) {
		examErrs = append(examErrs, errf(1, "la suma de pesos debe ser un número finito"))
	} else if weight <= 0 {
		examErrs = append(examErrs, errf(1, "el examen debe tener al menos una comprobación con peso positivo"))
	}
	if exam.Defaults.Weight != nil && (math.IsNaN(*exam.Defaults.Weight) || math.IsInf(*exam.Defaults.Weight, 0) || *exam.Defaults.Weight < 0) {
		examErrs = append(examErrs, errf(1, "por_defecto.peso debe ser finito y no negativo"))
	}
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
			CheckCount:      len(checks),
			TotalWeight:     totalWeight(checks),
			CheckIDs:        checkIDs(checks),
			Concurrency:     DefaultConcurrency,
			HostConcurrency: DefaultHostConcurrency,
		},
	}
	if err := validateResultBudget(plan); err != nil {
		return nil, withFile(examPath, errf(1, "%s", err))
	}
	plan.Summary.EvidenceBytesPerField = (16 << 20) / (3 * len(students) * len(checks))
	if plan.Summary.EvidenceBytesPerField > 65536 {
		plan.Summary.EvidenceBytesPerField = 65536
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
			if check.Weight != nil && (math.IsNaN(*check.Weight) || math.IsInf(*check.Weight, 0) || *check.Weight < 0) {
				*errs = append(*errs, errf(check.Line,
					"peso negativo o no finito (%v) en %q: debe ser finito y no negativo", *check.Weight, check.ID))
			}

			// 3. logical host used but not declared. A check without a
			// command runs nowhere and needs no host.
			hasCmd := len(check.Cmd) > 0
			if check.File != nil {
				if check.commandPresent || hasCmd || check.valuePresent || check.Value != "" {
					*errs = append(*errs, errf(check.Line, "la comprobación %q debe elegir solo una fuente: fichero, cmd o valor", check.ID))
				}
				if *check.File == "" || strings.ContainsRune(*check.File, 0) {
					*errs = append(*errs, errf(check.Line, "fichero de %q debe ser una ruta absoluta no vacía y sin caracteres nulos", check.ID))
				}
				if check.ExitCode != nil {
					*errs = append(*errs, errf(check.Line, "fichero de %q solo admite aserciones de contenido; exit_code requiere cmd", check.ID))
				}
				hasCmd = true
			}
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

			// A check without a command has no process, so there is no
			// exit status to compare. Caught here, in the PLAN, and not at
			// run time: an exam that cannot be evaluated must not reach any
			// machine.
			if !hasCmd && check.ExitCode != nil {
				*errs = append(*errs, errf(check.Line,
					"la comprobación %q compara el código de salida, pero no ejecuta ningún comando",
					check.ID))
			}

			// cerca_de needs its three parts: an anchor to look for, a
			// window that is not negative, and something to find inside it.
			if n := check.Near; n != nil {
				switch {
				case n.Anchor == "":
					*errs = append(*errs, errf(check.Line,
						"el cerca_de de %q no tiene ancla:", check.ID))
				case n.Contains == "":
					*errs = append(*errs, errf(check.Line,
						"el cerca_de de %q no dice qué debe contener", check.ID))
				case n.Lines < 0:
					*errs = append(*errs, errf(check.Line,
						"el cerca_de de %q tiene lineas: %d, que no puede ser negativo",
						check.ID, n.Lines))
				}
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

		fileTimeouts := map[[2]string]ResolvedCheck{}
		sc := scope{studentID: student.ID, fields: studentFields(student), hosts: student.Hosts}
		for _, check := range checks {
			resolved, err := resolveCheck(check, sc, exam)
			if err != nil {
				errs = append(errs, withFile(examPath, errf(check.Line, "%s", err)))
				continue
			}
			if resolved.File != "" {
				key := [2]string{resolved.Host, resolved.File}
				if first, ok := fileTimeouts[key]; ok && first.Timeout != resolved.Timeout {
					errs = append(errs, withFile(examPath, errf(check.Line,
						"fichero %q en %q del alumno %q tiene timeout %s en %q y %s en %q: la lectura compartida necesita el mismo tiempo límite",
						resolved.File, resolved.Host, student.ID, first.Timeout, first.ID, resolved.Timeout, resolved.ID)))
				}
				fileTimeouts[key] = resolved
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

	if check.File != nil {
		file, err := substitute(*check.File, sc)
		if err != nil {
			return ResolvedCheck{}, err
		}
		if !strings.HasPrefix(file, "/") || strings.ContainsRune(file, 0) {
			return ResolvedCheck{}, fmt.Errorf("fichero de %q debe ser una ruta absoluta no vacía y sin caracteres nulos", check.ID)
		}
		out.File = file
		out.Cmd = []string{"cat", "--", file}
	}

	var err error
	if out.Value, err = substitute(check.Value, sc); err != nil {
		return ResolvedCheck{}, err
	}
	if len(out.Value) > model.MaxStreamBytes {
		return ResolvedCheck{}, fmt.Errorf("el valor resuelto de %q supera el límite de %d bytes", check.ID, model.MaxStreamBytes)
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
		File     string   `json:"file,omitempty"`
		Cmd      []string `json:"cmd"`
		Value    string   `json:"value"`
		Assert   string   `json:"assert"`
		Expected string   `json:"expected"`
	}
	header := struct {
		Exam      string  `json:"exam"`
		Inventory string  `json:"inventory"`
		Total     float64 `json:"total_weight"`
	}{
		Exam:      p.Exam.SHA256,
		Inventory: p.Inventory.SHA256,
		Total:     p.Summary.TotalWeight,
	}
	h := sha256.New()
	write := func(data []byte) { _, _ = h.Write(data) }
	writeJSON := func(value any) bool {
		data, err := json.Marshal(value)
		if err != nil {
			return false
		}
		write(data)
		return true
	}
	data, err := json.Marshal(header)
	if err != nil {
		return ""
	}
	write(data[:len(data)-1]) // Replace the closing brace with students.
	if len(p.Students) == 0 {
		write([]byte(`,"students":null}`))
		return hex.EncodeToString(h.Sum(nil))
	}
	write([]byte(`,"students":[`))
	order := make([]int, len(p.Students))
	for i := range order {
		order[i] = i
	}
	sort.Slice(order, func(i, j int) bool { return p.Students[order[i]].ID < p.Students[order[j]].ID })
	for i, index := range order {
		if i > 0 {
			write([]byte{','})
		}
		s := &p.Students[index]
		studentHeader := struct {
			ID       string `json:"id"`
			Excluded bool   `json:"excluded"`
		}{ID: s.ID, Excluded: s.Excluded}
		data, err := json.Marshal(studentHeader)
		if err != nil {
			return ""
		}
		write(data[:len(data)-1])
		if len(s.Checks) == 0 {
			write([]byte(`,"checks":null}`))
			continue
		}
		write([]byte(`,"checks":[`))
		for j, c := range s.Checks {
			if j > 0 {
				write([]byte{','})
			}
			kind, expected := assertionOf(c)
			if !writeJSON(hashedCheck{
				ID: c.ID, Group: c.Group, Weight: c.Weight,
				Timeout: c.Timeout.String(),
				Host:    c.Host,
				Address: fmt.Sprintf("%s:%d", c.Target.IP, c.Target.Port),
				User:    c.Target.User,
				File:    c.File, Cmd: c.Cmd, Value: c.Value,
				Assert: kind, Expected: expected,
			}) {
				return ""
			}
		}
		write([]byte(`]}`))
	}
	write([]byte(`]}`))
	return hex.EncodeToString(h.Sum(nil))
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

// Budget the configuration copied into results, excluding inventory responses
// (runtime evidence). This reserve includes JSON escaping and repeated fields.
func validateResultBudget(p *Plan) error {
	cells := len(p.Students) * p.Summary.CheckCount
	if cells > model.MaxResultCells {
		return fmt.Errorf("el examen y el aula superan el límite de %d comprobaciones por corrección; divide el aula o el examen antes de corregir", model.MaxResultCells)
	}
	projected := *p
	projected.Students = append([]StudentPlan(nil), p.Students...)
	for i := range projected.Students {
		projected.Students[i].Checks = append([]ResolvedCheck(nil), p.Students[i].Checks...)
		for j := range projected.Students[i].Checks {
			projected.Students[i].Checks[j].Value = ""
		}
	}
	data, err := json.Marshal(projected)
	if err != nil {
		return err
	}
	if len(data) > model.MaxResultMetadataBytes {
		return fmt.Errorf("el examen y el aula superan el presupuesto de 1 MiB de datos descriptivos del resultado; reduce textos y argumentos antes de corregir")
	}
	return nil
}
