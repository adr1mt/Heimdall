package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"heimdall/internal/model"
)

// readArtifact is shared by retries, consolidation and exam sessions.
// The limit applies to bytes read, even if a file grows while it is open.
func readArtifact(path string) (*model.RunResult, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("no se pudo leer la corrección anterior de %s: %w", path, err)
	}
	defer file.Close()
	return readArtifactFrom(path, file)
}

// The reader seam also covers sources whose length is not known in advance.
func readArtifactFrom(path string, source io.Reader) (*model.RunResult, error) {
	data, err := io.ReadAll(io.LimitReader(source, model.MaxArtifactBytes+1))
	if err != nil {
		return nil, fmt.Errorf("no se pudo leer la corrección anterior de %s: %w", path, err)
	}
	if len(data) > model.MaxArtifactBytes {
		return nil, fmt.Errorf("%s: el fichero de resultados supera el límite de 64 MiB", path)
	}
	var run model.RunResult
	if err := json.Unmarshal(data, &run); err != nil {
		return nil, fmt.Errorf("%s no es un resultado de Heimdall: %s", path, err)
	}
	if run.SchemaVersion != model.SchemaVersion {
		return nil, fmt.Errorf("%s está escrito en la versión %d del formato y este motor entiende la %d", path, run.SchemaVersion, model.SchemaVersion)
	}
	if run.RunID == "" {
		return nil, fmt.Errorf("%s no dice de qué ejecución es", path)
	}
	if err := model.ValidateArtifactJSON(data); err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	if err := model.ValidateArtifact(&run); err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	return &run, nil
}
