"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Clock, FileText, FileUp, Loader2, ShieldCheck, ShieldX, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormField } from "@/components/forms/form-field"
import { ApiError, apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import { threeLetterMonth } from "@/lib/spending"

type DocumentType = "GHANA_CARD" | "PASSPORT" | "VOTERS_ID" | "DRIVERS_LICENSE" | "NATIONAL_ID"
type VerificationStatus = "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED"

interface Verification {
  id: number
  documentType: DocumentType
  status: VerificationStatus
  rejectionReason?: string | null
  createdAt: string
  reviewedAt?: string | null
  // Echoed back so a rejected submission can be corrected, not retyped (P4).
  idNumber?: string | null
  fullLegalName?: string | null
  dateOfBirth?: string | null
  additionalNotes?: string | null
}

/** "25 Oct 2026". */
const formatDay = (iso: string) =>
  threeLetterMonth(new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))

/** What was picked, kept for the preview; `preview` is an object URL for images. */
interface PickedFile {
  name: string
  url: string
  preview: string | null
}

const DOCUMENT_TYPES: Array<{ value: DocumentType; label: string; hasBack: boolean }> = [
  { value: "GHANA_CARD", label: "Ghana Card", hasBack: true },
  { value: "PASSPORT", label: "Passport", hasBack: false },
  { value: "VOTERS_ID", label: "Voter's ID", hasBack: true },
  { value: "DRIVERS_LICENSE", label: "Driver's licence", hasBack: true },
  { value: "NATIONAL_ID", label: "Other national ID", hasBack: true },
]

const MB = 1024 * 1024
const DOCUMENT_TYPES_ACCEPTED = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
const SELFIE_TYPES_ACCEPTED = ["image/jpeg", "image/png", "image/webp"]

type Slot = "front" | "back" | "selfie"

/**
 * Settings → Verification (QA KYC-01; was `/dashboard/artisan/verification`,
 * which now redirects here). Shows the latest submission's
 * status and, when there is none or it was rejected, takes the ID document
 * and a selfie, uploaded to private storage (POST /uploads/document and
 * /uploads/selfie), then submits them for an admin to review.
 */
export function VerificationTab() {
  const [latest, setLatest] = useState<Verification | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  const [documentType, setDocumentType] = useState<DocumentType>("GHANA_CARD")
  const [idNumber, setIdNumber] = useState("")
  const [fullLegalName, setFullLegalName] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [notes, setNotes] = useState("")
  const [files, setFiles] = useState<Record<Slot, PickedFile | null>>({
    front: null,
    back: null,
    selfie: null,
  })
  const [uploading, setUploading] = useState<Slot | null>(null)
  const [errors, setErrors] = useState<Partial<Record<"front" | "back" | "selfie" | "idNumber" | "fullLegalName", string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  // The artisan profile id, for "See it as a client" once approved.
  const [profileId, setProfileId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    apiFetch<Verification>("/verification/me")
      .then((v) => {
        setLatest(v)
        // P4: a rejected submission comes back pre-filled, so the artisan
        // fixes what was wrong instead of starting over. Files are picked
        // again — the reviewer asked for new ones.
        if (v.status === "REJECTED") {
          setDocumentType(v.documentType)
          setIdNumber(v.idNumber ?? "")
          setFullLegalName(v.fullLegalName ?? "")
          setDateOfBirth(v.dateOfBirth ? v.dateOfBirth.slice(0, 10) : "")
          setNotes(v.additionalNotes ?? "")
        }
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 404)) setLoadFailed(true)
      })
      .finally(() => setIsLoading(false))
    apiFetch<{ id: string }>("/users/me/artisan-profile")
      .then((p) => setProfileId(p.id))
      .catch(() => {})
  }, [])

  // Object URLs for the previews are released when replaced and on unmount.
  const filesRef = useRef(files)
  filesRef.current = files
  useEffect(
    () => () => {
      Object.values(filesRef.current).forEach((f) => f?.preview && URL.revokeObjectURL(f.preview))
    },
    [],
  )
  const setSlot = (slot: Slot, next: PickedFile | null) =>
    setFiles((prev) => {
      const old = prev[slot]
      if (old?.preview) URL.revokeObjectURL(old.preview)
      return { ...prev, [slot]: next }
    })

  const docType = DOCUMENT_TYPES.find((d) => d.value === documentType)!

  const upload = async (slot: Slot, file: File) => {
    const accepted = slot === "selfie" ? SELFIE_TYPES_ACCEPTED : DOCUMENT_TYPES_ACCEPTED
    const limit = slot === "selfie" ? 5 * MB : 10 * MB
    // Errors show under the slot they belong to, not only in a toast.
    if (!accepted.includes(file.type)) {
      setErrors((p) => ({ ...p, [slot]: slot === "selfie" ? "Use a JPEG, PNG or WebP photo." : "Use a JPEG, PNG, WebP or PDF file." }))
      return
    }
    if (file.size > limit) {
      setErrors((p) => ({ ...p, [slot]: `That file is larger than ${limit / MB} MB.` }))
      return
    }
    setErrors((p) => ({ ...p, [slot]: undefined }))
    setUploading(slot)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await apiFetch<{ url: string }>(slot === "selfie" ? "/uploads/selfie" : "/uploads/document", {
        method: "POST",
        body: form,
      })
      setSlot(slot, {
        name: file.name,
        url: res.url,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      })
    } catch (err) {
      setErrors((p) => ({ ...p, [slot]: err instanceof Error && err.message ? err.message : "Couldn’t upload this file. Try again." }))
    } finally {
      setUploading(null)
    }
  }

  const submit = async () => {
    const next: typeof errors = {}
    if (!fullLegalName.trim()) next.fullLegalName = "Enter your name exactly as it appears on the document."
    if (!idNumber.trim()) next.idNumber = "Enter the document number."
    if (!files.front) next.front = "Add the front of your document."
    if (!files.selfie) next.selfie = "Add a clear selfie."
    setErrors(next)
    if (Object.keys(next).length) {
      document.getElementById(Object.keys(next)[0] === "fullLegalName" ? "kyc-name" : `kyc-${Object.keys(next)[0]}`)?.focus()
      return
    }
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const created = await apiFetch<Verification>("/verification", {
        method: "POST",
        body: JSON.stringify({
          documentType,
          idNumber: idNumber.trim(),
          fullLegalName: fullLegalName.trim(),
          ...(dateOfBirth ? { dateOfBirth } : {}),
          documentFrontUrl: files.front!.url,
          ...(docType.hasBack && files.back ? { documentBackUrl: files.back.url } : {}),
          selfieUrl: files.selfie!.url,
          ...(notes.trim() ? { additionalNotes: notes.trim() } : {}),
        }),
      })
      setLatest(created)
      toast.success("Submitted for review")
    } catch (err) {
      setSubmitError(err instanceof Error && err.message ? err.message : "Couldn’t submit your documents. Try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const showForm = !latest || latest.status === "REJECTED"
  const isResubmission = latest?.status === "REJECTED"

  const fileSlot = (slot: Slot, label: string, optional = false) => {
    const current = files[slot]
    const error = errors[slot]
    const accept = (slot === "selfie" ? SELFIE_TYPES_ACCEPTED : DOCUMENT_TYPES_ACCEPTED).join(",")
    return (
      <FormField
        id={`kyc-${slot}`}
        label={label}
        optional={optional}
        error={error}
        hint={
          slot === "selfie"
            ? "Face the camera in good light, without sunglasses or a hat. JPEG, PNG or WebP, up to 5 MB."
            : "A clear photo or scan with all four corners showing. JPEG, PNG, WebP or PDF, up to 10 MB."
        }
      >
        {(control) =>
          current ? (
            <div className="flex items-center gap-3 rounded-lg border p-2 pr-1">
              {current.preview ? (
                // A local object URL of the file just picked — next/image can't optimise it.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.preview}
                  alt={`Preview of ${label.toLowerCase()}`}
                  className="h-16 w-16 shrink-0 rounded-md border object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted" aria-hidden="true">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{current.name}</span>
                <span className="block text-xs text-muted-foreground">Uploaded</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0"
                aria-label={`Remove ${label.toLowerCase()}`}
                onClick={() => setSlot(slot, null)}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <label
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground hover:bg-muted/40",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
                error && "border-destructive",
              )}
            >
              {uploading === slot ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <FileUp className="h-4 w-4" aria-hidden="true" />
              )}
              {uploading === slot ? "Uploading…" : slot === "selfie" ? "Take or choose a photo" : "Choose a file"}
              <input
                {...control}
                type="file"
                accept={accept}
                // Phones open the front camera for the selfie.
                {...(slot === "selfie" ? { capture: "user" as const } : {})}
                className="sr-only"
                disabled={uploading != null || isSubmitting}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (file) void upload(slot, file)
                }}
              />
            </label>
          )
        }
      </FormField>
    )
  }

  return (
    <>
      <div className="max-w-3xl space-y-6">
        <p className="text-sm text-muted-foreground">
          Verified artisans show a badge on their profile, so clients know who they&apos;re hiring.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground motion-reduce:animate-none" aria-label="Loading" />
          </div>
        ) : loadFailed ? (
          <Card className="gap-0 py-0">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Couldn&apos;t load your verification status. Refresh the page to try again.
            </CardContent>
          </Card>
        ) : (
          <>
            {latest && (
              <Card className="gap-0 py-0">
                <CardContent className="flex items-start gap-4 p-4 sm:p-5">
                  {latest.status === "APPROVED" ? (
                    <ShieldCheck className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
                  ) : latest.status === "REJECTED" ? (
                    <ShieldX className="h-6 w-6 shrink-0 text-destructive" aria-hidden="true" />
                  ) : (
                    <Clock className="h-6 w-6 shrink-0 text-warning" aria-hidden="true" />
                  )}
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-foreground">
                      {latest.status === "APPROVED"
                        ? "You're verified"
                        : latest.status === "REJECTED"
                          ? "Your last submission wasn't approved"
                          : "Your documents are being reviewed"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {latest.status === "APPROVED"
                        ? `Approved${latest.reviewedAt ? ` on ${formatDay(latest.reviewedAt)}` : ""}. Clients see a verified badge on your profile.`
                        : latest.status === "REJECTED"
                          ? latest.rejectionReason
                            ? `Reason: ${latest.rejectionReason}`
                            : "Check your documents and submit them again below."
                          : `Submitted ${formatDay(latest.createdAt)}. We'll notify you when an admin has checked them.`}
                    </p>
                    {latest.status === "APPROVED" && profileId && (
                      <Link
                        href={`/dashboard/user/artisan/${profileId}`}
                        className="inline-flex min-h-11 items-center text-sm font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
                      >
                        See your profile as a client
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {showForm && (
              <Card className="gap-0 py-0">
                <div className="border-b p-4 sm:p-6">
                  <h2 className="font-semibold text-foreground">{isResubmission ? "Submit again" : "Send your documents"}</h2>
                  <p className="text-sm text-muted-foreground">
                    {isResubmission
                      ? "We kept the details from last time. Fix what the reviewer mentioned and add your files again."
                      : "An admin checks your ID against your selfie."}
                  </p>
                </div>
                <CardContent className="p-4 sm:p-6">
                  <form
                    noValidate
                    className="space-y-5"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void submit()
                    }}
                  >
                    <FormField id="kyc-type" label="Document type">
                      {(control) => (
                        <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
                          <SelectTrigger id={control.id} className="w-full max-sm:h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DOCUMENT_TYPES.map((d) => (
                              <SelectItem key={d.value} value={d.value}>
                                {d.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </FormField>
                    <div className="grid gap-5 md:grid-cols-2">
                      <FormField id="kyc-name" label="Full legal name" error={errors.fullLegalName}>
                        {(control) => (
                          <Input
                            {...control}
                            className="max-sm:h-11"
                            value={fullLegalName}
                            maxLength={200}
                            autoComplete="name"
                            onChange={(e) => {
                              setFullLegalName(e.target.value)
                              setErrors((p) => ({ ...p, fullLegalName: undefined }))
                            }}
                          />
                        )}
                      </FormField>
                      <FormField id="kyc-idNumber" label="Document number" error={errors.idNumber}>
                        {(control) => (
                          <Input
                            {...control}
                            className="max-sm:h-11"
                            value={idNumber}
                            maxLength={100}
                            placeholder={documentType === "GHANA_CARD" ? "GHA-123456789-0" : undefined}
                            onChange={(e) => {
                              setIdNumber(e.target.value)
                              setErrors((p) => ({ ...p, idNumber: undefined }))
                            }}
                          />
                        )}
                      </FormField>
                    </div>
                    <FormField id="kyc-dob" label="Date of birth" optional>
                      {(control) => (
                        <Input
                          {...control}
                          type="date"
                          value={dateOfBirth}
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={(e) => setDateOfBirth(e.target.value)}
                          className="max-sm:h-11 md:w-1/2"
                        />
                      )}
                    </FormField>
                    <div className="grid gap-5 md:grid-cols-2">
                      {fileSlot("front", "Front of document")}
                      {docType.hasBack && fileSlot("back", "Back of document", true)}
                    </div>
                    {fileSlot("selfie", "Selfie")}
                    <FormField id="kyc-notes" label="Anything the reviewer should know" optional>
                      {(control) => (
                        <Textarea
                          {...control}
                          rows={3}
                          maxLength={1000}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      )}
                    </FormField>
                    <p className="text-xs text-muted-foreground">
                      Your documents are stored privately and only JinVa admins can see them.
                    </p>
                    {submitError && (
                      <p role="alert" className="text-sm text-destructive">
                        {submitError}
                      </p>
                    )}
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        className="max-sm:h-11 max-sm:w-full"
                        disabled={isSubmitting || uploading != null}
                      >
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                        {isResubmission ? "Submit again" : "Submit for review"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  )
}
