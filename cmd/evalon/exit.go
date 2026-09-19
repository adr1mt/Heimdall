package main

// Exit codes. They are the contract with the GUI and with any script driving
// the engine, so they must stay discriminant: a configuration error can never
// be confused with a partial run.
const (
	// exitOK means every check of every student was evaluated.
	exitOK = 0
	// exitInvalidConfig means the PLAN could not be resolved. No machine was
	// contacted and no artifact was written.
	exitInvalidConfig = 2
	// exitPartial means the run finished but some check stayed UNEVALUATED.
	exitPartial = 3
	// exitCancelled means the run was interrupted; a partial artifact exists.
	exitCancelled = 4
)
