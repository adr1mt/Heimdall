package plan

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"reflect"
	"strings"

	"gopkg.in/yaml.v3"
)

// LoadExam reads examen.yaml. Any key the schema does not know is an error
// with file and line; por_defecto is applied so every check comes out with a
// weight and a timeout.
func LoadExam(path string) (*Exam, error) {
	node, err := readDocument(path)
	if err != nil {
		return nil, err
	}
	var exam Exam
	if err := decode(path, node, &exam); err != nil {
		return nil, err
	}
	exam.applyDefaults()
	exam.markLines(node)
	return &exam, nil
}

// LoadInventory reads aula.yaml and folds comun.hosts into every student.
func LoadInventory(path string) (*Inventory, error) {
	node, err := readDocument(path)
	if err != nil {
		return nil, err
	}
	var inv Inventory
	if err := decode(path, node, &inv); err != nil {
		return nil, err
	}
	inv.inheritHosts()
	return &inv, nil
}

func readDocument(path string) (*yaml.Node, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("no se puede leer %s: %w", path, err)
	}
	var doc yaml.Node
	decoder := yaml.NewDecoder(bytes.NewReader(data))
	if err := decoder.Decode(&doc); err != nil {
		if err == io.EOF {
			return nil, &Error{File: path, Line: 1, Msg: "el fichero está vacío"}
		}
		return nil, withFile(path, syntaxError(err))
	}
	var extra yaml.Node
	if err := decoder.Decode(&extra); err != io.EOF {
		if err != nil {
			return nil, withFile(path, syntaxError(err))
		}
		return nil, &Error{File: path, Line: extra.Line, Msg: "solo se admite un documento YAML; elimina el documento adicional"}
	}
	if doc.Kind != yaml.DocumentNode || len(doc.Content) == 0 {
		return nil, &Error{File: path, Line: 1, Msg: "el fichero está vacío"}
	}
	return doc.Content[0], nil
}

// decode checks the keys first and only then fills the struct, so the teacher
// sees every unknown key of the file at once instead of one per run.
func decode(path string, node *yaml.Node, v any) error {
	var errs []error
	checkKeys(node, reflect.TypeOf(v).Elem(), "", &errs)
	if err := join(errs); err != nil {
		return withFile(path, err)
	}
	if err := node.Decode(v); err != nil {
		return withFile(path, syntaxError(err))
	}
	return nil
}

// syntaxError turns whatever yaml.v3 reports into our own error, so no Go type
// name ever reaches the teacher.
func syntaxError(err error) error {
	var planErr *Error
	if errors.As(err, &planErr) {
		return err
	}
	var typeErr *yaml.TypeError
	if errors.As(err, &typeErr) {
		out := make([]error, 0, len(typeErr.Errors))
		for _, msg := range typeErr.Errors {
			line, text := splitYAMLMessage(msg)
			out = append(out, errf(line, "%s", text))
		}
		return join(out)
	}
	line, text := splitYAMLMessage(err.Error())
	return errf(line, "%s", text)
}

// splitYAMLMessage pulls the line out of "yaml: line 12: ..." and drops the
// Go type names yaml.v3 puts in its messages.
func splitYAMLMessage(msg string) (int, string) {
	text := strings.TrimPrefix(msg, "yaml: ")
	line := 0
	if i := strings.Index(text, "line "); i == 0 {
		if j := strings.Index(text, ": "); j > 0 {
			if _, err := fmt.Sscanf(text[:j], "line %d", &line); err == nil {
				text = text[j+2:]
			}
		}
	}
	if i := strings.Index(text, " in type "); i > 0 {
		text = text[:i]
	}
	return line, text
}

// checkKeys walks the document against the shape of typ and reports every key
// the schema does not know and every value written with the wrong shape.
// yaml.v3's own KnownFields cannot be used: it applies to the top-level
// decoder only and it would also reject the free fields of a student, which
// are legal. The shape is checked here, and not left to the decoder, because
// yaml.v3 names Go types in its messages and the teacher does not read Go
// (T014).
func checkKeys(node *yaml.Node, typ reflect.Type, what string, errs *[]error) {
	if node.Kind == yaml.AliasNode {
		node = node.Alias
	}
	for typ != nil && typ.Kind() == reflect.Pointer {
		typ = typ.Elem()
	}
	checkShape(node, typ, what, errs)

	switch typ.Kind() {
	case reflect.Struct:
		if node.Kind != yaml.MappingNode {
			return
		}
		fields := yamlFields(typ)
		extras := typ == reflect.TypeOf(Student{})
		for i := 0; i+1 < len(node.Content); i += 2 {
			key, val := node.Content[i], node.Content[i+1]
			field, known := fields[key.Value]
			if !known {
				if !extras {
					*errs = append(*errs, errf(key.Line, "clave desconocida %q", key.Value))
				}
				continue
			}
			checkKeys(val, field.Type, fmt.Sprintf("la clave %q", key.Value), errs)
		}
	case reflect.Map:
		if node.Kind != yaml.MappingNode {
			return
		}
		for i := 1; i < len(node.Content); i += 2 {
			checkKeys(node.Content[i], typ.Elem(),
				fmt.Sprintf("la clave %q", node.Content[i-1].Value), errs)
		}
	case reflect.Slice:
		if node.Kind != yaml.SequenceNode {
			return
		}
		for _, item := range node.Content {
			checkKeys(item, typ.Elem(), "cada elemento de "+what, errs)
		}
	}
}

var unmarshalerType = reflect.TypeOf((*yaml.Unmarshaler)(nil)).Elem()

// checkShape reports a value written with the wrong shape in the teacher's
// own words: "la clave \"cerca_de\" debe ser un bloque de claves" instead of
// yaml.v3's "cannot unmarshal !!int into plan.NearSpec".
//
// Types with their own UnmarshalYAML (una duración, un alumno) are left alone:
// they already explain themselves in Spanish.
func checkShape(node *yaml.Node, typ reflect.Type, what string, errs *[]error) {
	if typ == nil || reflect.PointerTo(typ).Implements(unmarshalerType) {
		return
	}
	if node.Kind == yaml.ScalarNode && node.Tag == "!!null" {
		return // an empty value is absent, not malformed
	}
	if what == "" {
		what = "el contenido del fichero"
	}

	want := ""
	switch typ.Kind() {
	case reflect.Struct, reflect.Map:
		if node.Kind != yaml.MappingNode {
			want = "un bloque de claves"
		}
	case reflect.Slice:
		if node.Kind != yaml.SequenceNode {
			want = "una lista"
		}
	case reflect.String:
		if node.Kind != yaml.ScalarNode {
			want = "un valor simple"
		} else if node.Tag != "!!str" {
			want = "texto: escríbelo entre comillas"
		}
	case reflect.Bool:
		if node.Kind != yaml.ScalarNode || node.Tag != "!!bool" {
			want = "sí o no (true o false)"
		}
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		if node.Kind != yaml.ScalarNode || node.Tag != "!!int" {
			want = "un número entero"
		}
	case reflect.Float32, reflect.Float64:
		if node.Kind != yaml.ScalarNode || (node.Tag != "!!int" && node.Tag != "!!float") {
			want = "un número"
		}
	}
	if want != "" {
		*errs = append(*errs, errf(node.Line, "%s debe ser %s", what, want))
	}
}

func yamlFields(typ reflect.Type) map[string]reflect.StructField {
	out := make(map[string]reflect.StructField, typ.NumField())
	for i := 0; i < typ.NumField(); i++ {
		f := typ.Field(i)
		name, _, _ := strings.Cut(f.Tag.Get("yaml"), ",")
		switch name {
		case "", "-":
			continue
		}
		out[name] = f
	}
	return out
}

// applyDefaults resolves por_defecto into every check. After this, Weight and
// Timeout are never nil and nothing downstream has to guess.
func (e *Exam) applyDefaults() {
	weight := DefaultWeight
	if e.Defaults.Weight != nil {
		weight = *e.Defaults.Weight
	}
	timeout := DefaultTimeout
	if e.Defaults.Timeout != nil {
		timeout = *e.Defaults.Timeout
	}
	for g := range e.Groups {
		for c := range e.Groups[g].Checks {
			check := &e.Groups[g].Checks[c]
			if check.Weight == nil {
				w := weight
				check.Weight = &w
			}
			if check.Timeout == nil {
				t := timeout
				check.Timeout = &t
			}
		}
	}
}

// markLines walks the document again to remember where each check was
// written. The teacher gets "examen.yaml:34" instead of "la comprobación 7".
func (e *Exam) markLines(node *yaml.Node) {
	groups := childValue(node, "grupos")
	if groups == nil {
		return
	}
	for g := 0; g < len(groups.Content) && g < len(e.Groups); g++ {
		checks := childValue(groups.Content[g], "comprobaciones")
		if checks == nil {
			continue
		}
		for c := 0; c < len(checks.Content) && c < len(e.Groups[g].Checks); c++ {
			check := &e.Groups[g].Checks[c]
			check.Line = checks.Content[c].Line
			if childValue(checks.Content[c], "fichero") != nil {
				if check.File == nil {
					empty := ""
					check.File = &empty
				}
				check.commandPresent = childValue(checks.Content[c], "cmd") != nil
				check.valuePresent = childValue(checks.Content[c], "valor") != nil
			}
		}
	}
}

func childValue(node *yaml.Node, key string) *yaml.Node {
	if node == nil || node.Kind != yaml.MappingNode {
		return nil
	}
	for i := 0; i+1 < len(node.Content); i += 2 {
		if node.Content[i].Value == key {
			return node.Content[i+1]
		}
	}
	return nil
}

// inheritHosts folds comun.hosts into each student's hosts, field by field.
// What the student writes wins; what the student omits comes from comun.
func (inv *Inventory) inheritHosts() {
	for s := range inv.Students {
		student := &inv.Students[s]
		merged := make(map[string]Host, len(inv.Common.Hosts)+len(student.Hosts))
		for name, common := range inv.Common.Hosts {
			merged[name] = common
		}
		for name, own := range student.Hosts {
			base := merged[name]
			if own.IP != "" {
				base.IP = own.IP
			}
			if own.Port != 0 {
				base.Port = own.Port
			}
			if own.User != "" {
				base.User = own.User
			}
			if own.PasswordRef != "" {
				base.PasswordRef = own.PasswordRef
			}
			if own.Password != "" {
				base.Password = own.Password
			}
			merged[name] = base
		}
		student.Hosts = merged
	}
}
