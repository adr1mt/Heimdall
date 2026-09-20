package report_test

import (
	"encoding/json"
	"os"
	"reflect"
	"sort"
	"strings"
	"testing"

	"heimdall/internal/model"
)

// schemaPath is the published description of the artifact. The GUI reads the
// artifact against it, so it may not drift from the types silently: this test
// is the only thing standing between a renamed field and a consumer that
// stops seeing a grade.
const schemaPath = "../../docs/design/schema/run-result.schema.json"

// types maps each place of the schema to the Go type it describes. The root
// of the document is RunResult; everything else lives under $defs.
var types = map[string]any{
	"":                model.RunResult{},
	"SourceRef":       model.SourceRef{},
	"PlanSummary":     model.PlanSummary{},
	"StudentResult":   model.StudentResult{},
	"Score":           model.Score{},
	"CheckResult":     model.CheckResult{},
	"ExecutionResult": model.ExecutionResult{},
	"Stream":          model.Stream{},
	"AssertionResult": model.AssertionResult{},
	"Warning":         model.Warning{},
	"RetryRef":        model.RetryRef{},
	"PreviousAttempt": model.PreviousAttempt{},
}

func loadSchema(t *testing.T) map[string]any {
	t.Helper()
	data, err := os.ReadFile(schemaPath)
	if err != nil {
		t.Fatalf("no se pudo leer el esquema: %s", err)
	}
	var doc map[string]any
	if err := json.Unmarshal(data, &doc); err != nil {
		t.Fatalf("el esquema no es JSON válido: %s", err)
	}
	return doc
}

// object returns the schema object describing def, "" meaning the root.
func object(t *testing.T, doc map[string]any, def string) map[string]any {
	t.Helper()
	if def == "" {
		return doc
	}
	defs, ok := doc["$defs"].(map[string]any)
	if !ok {
		t.Fatal("el esquema no tiene $defs")
	}
	obj, ok := defs[def].(map[string]any)
	if !ok {
		t.Fatalf("el esquema no describe %s", def)
	}
	return obj
}

// fieldsOf reads the JSON contract of a Go struct: the name of every field
// that is written, and whether it is always written.
func fieldsOf(v any) (all []string, required []string) {
	rt := reflect.TypeOf(v)
	for i := 0; i < rt.NumField(); i++ {
		tag := rt.Field(i).Tag.Get("json")
		if tag == "-" || tag == "" {
			continue
		}
		parts := strings.Split(tag, ",")
		name := parts[0]
		all = append(all, name)
		optional := false
		for _, opt := range parts[1:] {
			if opt == "omitempty" {
				optional = true
			}
		}
		if !optional {
			required = append(required, name)
		}
	}
	sort.Strings(all)
	sort.Strings(required)
	return all, required
}

func keys(m map[string]any) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func strings_(v any) []string {
	list, _ := v.([]any)
	out := make([]string, 0, len(list))
	for _, s := range list {
		out = append(out, s.(string))
	}
	sort.Strings(out)
	return out
}

// Every field of the canonical types is described, and the schema describes
// no field that does not exist.
func TestSchemaDescribesExactlyTheCanonicalTypes(t *testing.T) {
	doc := loadSchema(t)
	for def, value := range types {
		obj := object(t, doc, def)
		props, ok := obj["properties"].(map[string]any)
		if !ok {
			t.Errorf("%s: el esquema no lista properties", def)
			continue
		}
		fields, _ := fieldsOf(value)
		if got, want := keys(props), fields; !reflect.DeepEqual(got, want) {
			t.Errorf("%s: el esquema describe %v y el tipo tiene %v", name(def), got, want)
		}
	}
}

// A field without omitempty is always in the artifact, so it is required. A
// consumer that trusts the schema must not find a hole.
func TestSchemaRequiresEveryFieldThatIsAlwaysWritten(t *testing.T) {
	doc := loadSchema(t)
	for def, value := range types {
		obj := object(t, doc, def)
		_, required := fieldsOf(value)
		if got := strings_(obj["required"]); !reflect.DeepEqual(got, required) {
			t.Errorf("%s: required = %v, se esperaba %v", name(def), got, required)
		}
	}
}

// The version in the schema is the version the engine writes.
func TestSchemaPinsTheVersionTheEngineWrites(t *testing.T) {
	doc := loadSchema(t)
	props := doc["properties"].(map[string]any)
	version := props["schema_version"].(map[string]any)
	if got := int(version["const"].(float64)); got != model.SchemaVersion {
		t.Errorf("el esquema fija schema_version %d y el motor escribe %d", got, model.SchemaVersion)
	}
}

// The closed enumerations of the model are closed in the schema too: a status
// or a cause the schema does not know would reach the GUI as a surprise.
func TestSchemaListsTheClosedEnumerations(t *testing.T) {
	doc := loadSchema(t)
	want := map[string][]string{
		"RunStatus":      {"CANCELLED", "COMPLETE", "INVALID_CONFIG", "PARTIAL"},
		"StudentStatus":  {"EXCLUDED", "NOT_EVALUATED", "OK", "PARTIAL"},
		"ScoreStatus":    {"COMPLETE", "EXCLUDED", "INCOMPLETE", "NOT_EVALUATED"},
		"AcademicStatus": {"FAIL", "PASS", "UNEVALUATED"},
		"Cause": {
			"AUTH_FAILED", "CANCELLED", "CONNECTION_LOST", "CONNECT_FAILED",
			"ENGINE_ERROR", "NONE", "NOT_RUN", "OUTPUT_OVERFLOW", "TIMEOUT",
		},
		"RemoteProcessState": {"FINISHED", "KILLED_REMOTE", "UNKNOWN"},
	}
	for def, values := range want {
		obj := object(t, doc, def)
		if got := strings_(obj["enum"]); !reflect.DeepEqual(got, values) {
			t.Errorf("%s: enum = %v, se esperaba %v", def, got, values)
		}
	}
}

func name(def string) string {
	if def == "" {
		return "RunResult"
	}
	return def
}
