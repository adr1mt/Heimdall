// Package report writes the canonical artifact to disk.
//
// Two rules govern everything here. The artifact is written atomically, so a
// run that dies never leaves half a file and two runs never overwrite each
// other (F-13, F-16). And no secret value reaches the disk: the substitution
// rules already make that structurally impossible, and this is the second
// line of defence that says so out loud when it fires (security.md §1.6).
package report

import (
	"fmt"
	"os"
	"path/filepath"

	"heimdall/internal/model"
)

// Redacted replaces any secret value found on its way to the artifact.
const Redacted = "[oculto]"

// WarnSecretRedacted is the code of the warning the writer adds when it had
// to redact something. A silent redaction would hide a leak in the engine.
const WarnSecretRedacted = "SECRET_REDACTED"

// Writer writes the artifact of one run into a directory, usually var/.
type Writer struct {
	dir      string
	runID    string
	secrets  []string              // values, never references
	prepared []model.StudentResult // derived evidence from completed students
	ready    []bool
	hits     int
	clipped  bool
}

// New returns a writer for run runID under dir, creating dir if needed. The
// secrets are the values the run was given; the writer only uses them to
// recognise them in the output, never to write them.
func New(dir, runID string, secrets []string) (*Writer, error) {
	if runID == "" {
		return nil, fmt.Errorf("report: la ejecución no tiene identificador")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("report: no se pudo crear %s: %w", dir, err)
	}
	kept := make([]string, 0, len(secrets))
	for _, s := range secrets {
		if s != "" {
			kept = append(kept, s)
		}
	}
	return &Writer{dir: dir, runID: runID, secrets: kept}, nil
}

// FinalPath is where the finished artifact of this run lives.
func (w *Writer) FinalPath() string {
	return filepath.Join(w.dir, "run-"+w.runID+".json")
}

// PartialPath is where the run keeps what it has so far. It is rewritten
// after every student, so a run that is killed still leaves usable evidence.
func (w *Writer) PartialPath() string {
	return filepath.Join(w.dir, "run-"+w.runID+".partial.json")
}

// WritePartial rewrites the partial artifact with everything gathered so far.
func (w *Writer) WritePartial(run *model.RunResult) error {
	if run == nil {
		return fmt.Errorf("report: no hay resultado que copiar")
	}
	if w.prepared == nil {
		w.prepared = make([]model.StudentResult, len(run.Students))
		w.ready = make([]bool, len(run.Students))
	}
	if len(w.prepared) != len(run.Students) {
		return fmt.Errorf("report: cambió el número de alumnos del resultado parcial")
	}
	cells := len(run.Students) * run.Plan.CheckCount
	limit := evidenceLimit(run.Plan, cells)
	for i := range run.Students {
		if w.ready[i] || run.Students[i].Status == "" {
			continue
		}
		// A finished student is immutable in the engine. Prepare its evidence
		// once, then keep the bounded copy until this run finishes.
		single := &model.RunResult{Students: []model.StudentResult{run.Students[i]}}
		clean, hits, err := redact(single, w.secrets)
		if err != nil {
			return err
		}
		w.hits += hits
		w.clipped = boundStudent(&clean.Students[0], limit) || w.clipped
		w.prepared[i] = clean.Students[0]
		w.ready[i] = true
	}
	// Metadata and warnings can change between students, so take them from
	// the engine's current artifact on every publication.
	meta := *run
	meta.Students = nil
	clean, hits, err := redact(&meta, w.secrets)
	if err != nil {
		return err
	}
	if hits > 0 {
		clean.Warnings = clean.Warnings[:len(clean.Warnings)-1]
	}
	if hits+w.hits > 0 {
		clean.Warnings = append(clean.Warnings, secretWarning(hits+w.hits))
	}
	clean.Students = w.prepared
	if boundWarnings(clean, cells) || w.clipped {
		addEvidenceWarning(clean)
	}
	return writePrepared(clean, w.PartialPath())
}

// WriteFinal writes the finished artifact, points var/latest.json at it and
// removes the partial. It returns the path written.
//
// It is called for every run that resolved its PLAN, including the run where
// every single student failed: an artifact full of UNEVALUATED is a result,
// and not writing it would be the silent error.
func (w *Writer) WriteFinal(run *model.RunResult) (string, error) {
	path := w.FinalPath()
	if err := w.write(run, path); err != nil {
		return "", err
	}
	if err := linkLatest(w.dir, filepath.Base(path)); err != nil {
		return path, err
	}
	if err := os.Remove(w.PartialPath()); err != nil && !os.IsNotExist(err) {
		return path, fmt.Errorf("report: no se pudo borrar el parcial: %w", err)
	}
	return path, nil
}

// write redacts, serialises and stores the artifact atomically.
func (w *Writer) write(run *model.RunResult, path string) error {
	clean, err := Redact(run, w.secrets)
	if err != nil {
		return err
	}
	boundEvidence(clean)
	return writePrepared(clean, path)
}

func writePrepared(clean *model.RunResult, path string) error {
	data, err := model.MarshalCanonical(clean)
	if err != nil {
		return fmt.Errorf("report: no se pudo serializar el artefacto: %w", err)
	}
	if len(data) > model.MaxArtifactBytes {
		return fmt.Errorf("report: el resultado supera el presupuesto de 64 MiB")
	}
	return WriteAtomic(path, data)
}

// WriteAtomic writes data to path through a temporary file in the same
// directory and a rename. A reader sees either the previous file or the
// complete new one, never a half-written artifact.
func WriteAtomic(path string, data []byte) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".tmp-"+filepath.Base(path)+"-*")
	if err != nil {
		return fmt.Errorf("report: no se pudo crear el temporal en %s: %w", dir, err)
	}
	name := tmp.Name()
	defer os.Remove(name) // no-op once the rename succeeded

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return fmt.Errorf("report: no se pudo escribir %s: %w", name, err)
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return fmt.Errorf("report: no se pudo volcar %s a disco: %w", name, err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("report: no se pudo cerrar %s: %w", name, err)
	}
	if err := os.Chmod(name, 0o644); err != nil {
		return fmt.Errorf("report: no se pudieron fijar los permisos de %s: %w", name, err)
	}
	if err := os.Rename(name, path); err != nil {
		return fmt.Errorf("report: no se pudo publicar %s: %w", path, err)
	}
	return nil
}

// linkLatest points dir/latest.json at target. It is a convenience for the
// teacher and for the scripts; nothing in the engine reads it back.
func linkLatest(dir, target string) error {
	link := filepath.Join(dir, "latest.json")
	// The temporary name carries the target's, so two runs publishing at the
	// same time never fight over the same path.
	tmp := link + "." + target + ".tmp"
	_ = os.Remove(tmp)
	if err := os.Symlink(target, tmp); err != nil {
		return fmt.Errorf("report: no se pudo crear el enlace latest.json: %w", err)
	}
	if err := os.Rename(tmp, link); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("report: no se pudo publicar latest.json: %w", err)
	}
	return nil
}
