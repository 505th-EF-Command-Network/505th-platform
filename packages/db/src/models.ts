/**
 * MongoDB models (Mongoose) shared by the website, 505th Hub and Cortana.
 *
 * Field names follow the old Firebase records where they still make sense, so
 * the migration is a straight copy. Every migrated document keeps its original
 * Firebase id in `legacyId` for traceability and rollback.
 */
import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { MEMBER_STATUSES, ROLES } from "./roles.ts";

const historyBase = {
  date: String,
  note: String,
  addedAt: Date,
  addedBy: String,
  editedAt: Date,
  editedBy: String,
};

// ───────────────────────── Members ─────────────────────────
const MemberSchema = new Schema(
  {
    legacyId: { type: String, index: true, sparse: true },
    discordId: { type: String, unique: true, sparse: true },
    discordUsername: String,
    email: { type: String, lowercase: true, trim: true, index: true, sparse: true },

    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true, default: "" },
    lastName: { type: String, required: true, trim: true },
    callsign: { type: String, trim: true, default: "" },

    rankKey: { type: String, index: true },
    /** Original rank text if it did not match the rank table (never lose data). */
    rankRaw: String,
    role: { type: String, enum: ROLES, default: "enlistee", index: true },
    status: { type: String, enum: MEMBER_STATUSES, default: "PENDING", index: true },

    platoon: { type: String, default: "" },
    joinedPlatoon: String,
    recruitSource: String,
    graduation: String,

    joinedAt: Date,
    registeredAt: Date,
    approvedAt: Date,
    approvedBy: String,
    leftAt: Date,

    attendance: {
      percent: { type: Number, default: 0 },
      opsAttended: { type: Number, default: 0 },
      opsEligible: { type: Number, default: 0 },
      lastAttendedDate: String,
    },
    promotionTracker: { type: Number, default: 0 },

    promotionHistory: [{ ...historyBase, fromRank: String, toRank: String, auto: Boolean }],
    platoonHistory: [{ ...historyBase, from: String, to: String, auto: Boolean }],
    commendationHistory: [{ ...historyBase, title: String, medalImg: String }],
    ribbonHistory: [{ ...historyBase, title: String }],
    warningHistory: [{ ...historyBase, severity: String }],

    displayPrefs: { brightness: Number, fontSize: Number },
  },
  { timestamps: true, collection: "members" },
);
MemberSchema.index({ status: 1, rankKey: 1 });

// ───────────────────────── Attendance ─────────────────────────
const AttendanceEventSchema = new Schema(
  {
    legacyId: { type: String, index: true, sparse: true },
    title: String,
    type: { type: String, enum: ["main_op", "patrol", "training", "fun_op", "other"], default: "other", index: true },
    date: { type: String, index: true }, // YYYY-MM-DD
    attendees: [{ type: Schema.Types.ObjectId, ref: "Member" }],
    excused: [{ type: Schema.Types.ObjectId, ref: "Member" }],
    /** Legacy ids that could not be matched to a member (kept, not dropped). */
    unmatchedLegacyIds: [String],
    locked: { type: Boolean, default: false },
    unlockedAt: Date,
    unlockedBy: String,
    createdBy: String,
    updatedBy: String,
  },
  { timestamps: true, collection: "attendance_events" },
);

const AttendanceSnapshotSchema = new Schema(
  {
    month: { type: String, unique: true }, // YYYY-MM
    snapshotAt: Date,
    totalOps: Number,
    memberCount: Number,
    members: [
      {
        member: { type: Schema.Types.ObjectId, ref: "Member" },
        legacyUid: String,
        name: String,
        rank: String,
        role: String,
        platoon: String,
        attended: Number,
        eligible: Number,
        missed: Number,
        rate: Number,
        pip: Number,
      },
    ],
  },
  { timestamps: true, collection: "attendance_snapshots" },
);

// ───────────────────────── After-Action Reports ─────────────────────────
const AarSchema = new Schema(
  {
    legacyId: { type: String, index: true, sparse: true },
    title: { type: String, required: true },
    date: Date,
    operationType: String,
    classification: String,
    location: String,
    unit: String,
    unitsInvolved: String,
    commander: String,
    author: String,
    filedBy: String,
    submittedBy: { type: Schema.Types.ObjectId, ref: "Member" },
    submittedByName: String,
    submittedAt: Date,
    personnel: Number,
    casualties: Number,
    result: String,
    /** All report text sections (summary, keyMoments, lessonsLearned, …). */
    sections: { type: Map, of: String, default: {} },
    attachments: [Schema.Types.Mixed],
  },
  { timestamps: true, collection: "aars" },
);

// ───────────────────────── Logs ─────────────────────────
const AuditLogSchema = new Schema(
  {
    legacyId: { type: String, index: true, sparse: true },
    at: { type: Date, default: () => new Date(), index: true },
    actor: { type: Schema.Types.ObjectId, ref: "Member" },
    actorName: String,
    actorRole: String,
    section: { type: String, index: true },
    action: String,
    details: String,
    source: { type: String, enum: ["website", "hub", "cortana", "migration", "legacy"], default: "website" },
  },
  { collection: "audit_logs" },
);

const AccessAttemptSchema = new Schema(
  {
    at: { type: Date, default: () => new Date(), index: true },
    discordId: { type: String, index: true },
    discordUsername: String,
    member: { type: Schema.Types.ObjectId, ref: "Member" },
    result: { type: String, enum: ["GRANTED", "PENDING", "DENIED"], index: true },
    reason: { type: String, enum: ["NONE", "NOT_IN_DISCORD", "NO_RECORD", "PENDING_APPROVAL", "LOW_CLEARANCE", "INACTIVE"] },
    target: { type: String, default: "terminal" },
    ip: String,
    userAgent: String,
  },
  { collection: "access_attempts" },
);

// ───────────────────────── Sessions (Discord login) ─────────────────────────
const SessionSchema = new Schema(
  {
    /** SHA-256 of the random cookie token — the raw token is never stored. */
    tokenHash: { type: String, unique: true },
    member: { type: Schema.Types.ObjectId, ref: "Member" },
    discordId: { type: String, index: true },
    discordUsername: String,
    discordAvatar: String,
    inGuild: Boolean,
    expiresAt: { type: Date, index: { expires: 0 } },
    lastSeenAt: Date,
  },
  { timestamps: true, collection: "sessions" },
);

// ───────────────────────── Site / unit config ─────────────────────────
const SiteContentSchema = new Schema(
  {
    key: { type: String, unique: true }, // e.g. "page_content", "unit_cards", "roster_meta"
    data: { type: Schema.Types.Mixed, default: {} },
    updatedBy: String,
  },
  { timestamps: true, collection: "site_content", minimize: false },
);

const UnitStatusSchema = new Schema(
  {
    key: { type: String, unique: true, default: "status" },
    opStatus: String,
    statusMessage: String,
    updatedBy: String,
  },
  { timestamps: true, collection: "unit_status" },
);

/** Raw copy of Firebase collections with no new home yet (chat, notifications, media…). */
const LegacyDocSchema = new Schema(
  {
    collectionName: { type: String, index: true },
    legacyId: String,
    legacyPath: { type: String, unique: true },
    data: Schema.Types.Mixed,
    createTime: Date,
    updateTime: Date,
  },
  { collection: "legacy_docs", minimize: false },
);

/**
 * Firestore-shaped documents used by the ORIGINAL Command Terminal (admin.html),
 * which still speaks the Firestore API through a local stand-in. One Mongo
 * document per Firestore document; `_id` is the full path ("users/abc",
 * "notifications/abc/items/xyz"). Sections move to proper models as they are
 * redesigned. `users` writes are mirrored into `members` by the website.
 */
const TerminalDocSchema = new Schema(
  {
    _id: { type: String, required: true },
    parent: { type: String, required: true, index: true },
    docId: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
    createTime: Date,
    updateTime: Date,
  },
  { collection: "terminal_fs", minimize: false, versionKey: false },
);

// ───────────────────────── Command Network app (Hub) sign-in ─────────────────────────
/** One signed-in copy of the desktop app. Only the SHA-256 of the token is stored. */
const HubSessionSchema = new Schema(
  {
    tokenHash: { type: String, unique: true },
    member: { type: Schema.Types.ObjectId, ref: "Member", index: true },
    discordId: { type: String, index: true },
    deviceName: { type: String, default: "Windows PC" },
    /** Sent by the app on each call (X-CN-App / X-CN-OS) — shown in My Devices. */
    appVersion: String,
    os: String,
    inGuild: Boolean,
    lastUsedAt: Date,
    revokedAt: Date,
    revokedReason: String,
    expiresAt: { type: Date, index: { expires: 0 } },
  },
  { timestamps: true, collection: "hub_sessions" },
);
/** Short-lived (5 min) one-time code from /hub/connect, swapped for a token with PKCE. */
const HubAuthCodeSchema = new Schema(
  {
    codeHash: { type: String, unique: true },
    challenge: String,
    member: { type: Schema.Types.ObjectId, ref: "Member" },
    discordId: String,
    deviceName: String,
    inGuild: Boolean,
    expiresAt: { type: Date, index: { expires: 0 } },
  },
  { timestamps: true, collection: "hub_auth_codes" },
);

function model<T extends Schema>(name: string, schema: T) {
  return (mongoose.models[name] as Model<InferSchemaType<T>>) ?? mongoose.model(name, schema);
}

export const Member = model("Member", MemberSchema);
export const AttendanceEvent = model("AttendanceEvent", AttendanceEventSchema);
export const AttendanceSnapshot = model("AttendanceSnapshot", AttendanceSnapshotSchema);
export const Aar = model("Aar", AarSchema);
export const AuditLog = model("AuditLog", AuditLogSchema);
export const AccessAttempt = model("AccessAttempt", AccessAttemptSchema);
export const Session = model("Session", SessionSchema);
export const SiteContent = model("SiteContent", SiteContentSchema);
export const UnitStatus = model("UnitStatus", UnitStatusSchema);
export const LegacyDoc = model("LegacyDoc", LegacyDocSchema);
export const TerminalDoc = model("TerminalDoc", TerminalDocSchema);
export const HubSession = model("HubSession", HubSessionSchema);
export const HubAuthCode = model("HubAuthCode", HubAuthCodeSchema);

export type MemberDoc = InferSchemaType<typeof MemberSchema> & { _id: mongoose.Types.ObjectId };
