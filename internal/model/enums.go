package model

// The five closed enumerations of the canonical model, plus the remote process
// state. They are string types so the JSON artifact stays readable and so a
// typo is a compile error instead of a wrong grade.
//
// Defined in docs/design/03-ESTADOS-Y-NOTA.md; see ADR-0005.

// RunStatus is the outcome of the whole run.
type RunStatus string

const (
	// RunComplete means every evaluable student ended OK.
	RunComplete RunStatus = "COMPLETE"
	// RunPartial means at least one student ended PARTIAL or NOT_EVALUATED.
	RunPartial RunStatus = "PARTIAL"
	// RunCancelled means the teacher stopped the run; the artifact is written
	// anyway with whatever was collected.
	RunCancelled RunStatus = "CANCELLED"
	// RunInvalidConfig means the PLAN did not resolve. No machine was touched.
	RunInvalidConfig RunStatus = "INVALID_CONFIG"
)

// StudentStatus is derived from the student's checks, never stored as input.
type StudentStatus string

const (
	// StudentOK means no UNEVALUATED check of weight > 0.
	StudentOK StudentStatus = "OK"
	// StudentPartial means some, but not all, checks of weight > 0 are
	// UNEVALUATED.
	StudentPartial StudentStatus = "PARTIAL"
	// StudentNotEvaluated means every check of weight > 0 is UNEVALUATED.
	StudentNotEvaluated StudentStatus = "NOT_EVALUATED"
	// StudentExcluded means the inventory excluded the student: nothing ran
	// and there is no grade.
	StudentExcluded StudentStatus = "EXCLUDED"
)

// ScoreStatus tells a consumer how to read the two scores. A consumer reading
// provisional_score without looking at this field is doing it wrong.
type ScoreStatus string

const (
	// ScoreComplete means everything was evaluated: final_score is set.
	ScoreComplete ScoreStatus = "COMPLETE"
	// ScoreIncomplete means something stayed UNEVALUATED: final_score is null.
	ScoreIncomplete ScoreStatus = "INCOMPLETE"
	// ScoreNotEvaluated means nothing could be evaluated. Not a zero.
	ScoreNotEvaluated ScoreStatus = "NOT_EVALUATED"
	// ScoreExcluded mirrors StudentExcluded.
	ScoreExcluded ScoreStatus = "EXCLUDED"
)

// AcademicStatus is the academic axis, per check. It is closed at three values
// on purpose: UNEVALUATED never becomes FAIL.
type AcademicStatus string

const (
	// Pass means the command ran to completion and the assertion held.
	Pass AcademicStatus = "PASS"
	// Fail means the command ran to completion and the assertion did not hold.
	// Exit code 127 on the student's machine is a Fail, not an engine fault.
	Fail AcademicStatus = "FAIL"
	// Unevaluated means there was no complete, trustworthy execution. It does
	// not enter the denominator.
	Unevaluated AcademicStatus = "UNEVALUATED"
)

// Cause is the technical axis. It is only meaningful when the status is
// UNEVALUATED; with PASS or FAIL it is always CauseNone.
type Cause string

const (
	// CauseNone accompanies every PASS and every FAIL.
	CauseNone Cause = "NONE"
	// CauseConnectFailed means the session could not be established.
	CauseConnectFailed Cause = "CONNECT_FAILED"
	// CauseAuthFailed means the server rejected the credentials.
	CauseAuthFailed Cause = "AUTH_FAILED"
	// CauseTimeout means the command was sent and did not finish in time. It
	// may have left an orphan process on the student's machine.
	CauseTimeout Cause = "TIMEOUT"
	// CauseConnectionLost means an established session dropped mid-way.
	CauseConnectionLost Cause = "CONNECTION_LOST"
	// CauseNotRun means the engine decided not to run the check.
	CauseNotRun Cause = "NOT_RUN"
	// CauseCancelled means the teacher stopped the run.
	CauseCancelled Cause = "CANCELLED"
	// CauseOutputOverflow means the command produced more output than the
	// engine is willing to read, so it was cut off before it could finish.
	// It is not a network fault: the exam asks for too much output.
	CauseOutputOverflow Cause = "OUTPUT_OVERFLOW"
	// CauseEngineError is the only cause that is a bug of ours. Never silent.
	CauseEngineError Cause = "ENGINE_ERROR"
)

// RemoteProcessState says whether a process may still be alive on the
// student's machine. Hiding this would hide work the teacher has to do.
type RemoteProcessState string

const (
	// RemoteFinished means the process ended and its exit status was received.
	RemoteFinished RemoteProcessState = "FINISHED"
	// RemoteKilledRemote means the engine closed the channel on timeout.
	RemoteKilledRemote RemoteProcessState = "KILLED_REMOTE"
	// RemoteUnknown means the engine cannot tell.
	RemoteUnknown RemoteProcessState = "UNKNOWN"
)
