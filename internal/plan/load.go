package plan

import (
	"errors"
	"fmt"
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
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return nil, withFile(path, syntaxError(err))
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
	checkKeys(node, reflect.TypeOf(v).Elem(), &errs)
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
// the schema does not know. yaml.v3's own KnownFields cannot be used: it
// applies to the top-level decoder only and it would also reject the free
// fields of a student, which are legal.
func checkKeys(node *yaml.Node, typ reflect.Type, errs *[]error) {
	if node.Kind == yaml.AliasNode {
		node = node.Alias
	}
	for typ != nil && typ.Kind() == reflect.Pointer {
		typ = typ.Elem()
	}

	switch typ.Kind() {
	case reflect.Struct:
		if node.Kind != yaml.MappingNode {
			return // shape mismatch: the decoder reports it with its line
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
			checkKeys(val, field.Type, errs)
		}
	case reflect.Map:
		if node.Kind != yaml.MappingNode {
			return
		}
		for i := 1; i < len(node.Content); i += 2 {
			checkKeys(node.Content[i], typ.Elem(), errs)
		}
	case reflect.Slice:
		if node.Kind != yaml.SequenceNode {
			return
		}
		for _, item := range node.Content {
			checkKeys(item, typ.Elem(), errs)
		}
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
