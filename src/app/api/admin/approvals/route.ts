import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { INITIATION_TASKS } from "@/lib/initiation";

/**
 * Admin review of manual task submissions.
 *
 * The previous flow ran client-side and was blocked by Firestore rules
 * (pending_approvals is update:false, and crediting another user's
 * user_initiation/users docs fails the `uid == userId` check). This route
 * runs server-side via the Admin SDK, which bypasses rules.
 *
 * POST { approvalId: string, action: "approve" | "reject" }
 *  - uid / taskId / signal are read SERVER-SIDE from the stored submission,
 *    never trusted from the client body.
 */
export async function POST(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));

    const body = await req.json().catch(() => null);
    if (!body) return err("Invalid body", 400);

    const { approvalId, action } = body as Record<string, unknown>;
    if (typeof approvalId !== "string" || !approvalId)
      return err("approvalId required", 400);
    if (action !== "approve" && action !== "reject")
      return err("action must be 'approve' or 'reject'", 400);

    const db          = getAdminDb();
    const approvalRef = db.collection("pending_approvals").doc(approvalId);
    const snap        = await approvalRef.get();
    if (!snap.exists) return err("Submission not found", 404);

    const data   = snap.data()!;
    const status = data.status as string | undefined;
    if (status && status !== "pending")
      return err(`Already ${status}`, 409);

    // ── Reject ────────────────────────────────────────────────────────────
    if (action === "reject") {
      await approvalRef.update({
        status:     "rejected",
        reviewedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, status: "rejected" });
    }

    // ── Approve ───────────────────────────────────────────────────────────
    const uid    = data.uid as string | undefined;
    const taskId = data.taskId as string | undefined;
    if (!uid || !taskId) return err("Submission missing uid/taskId", 400);

    // Server-authoritative reward — from the task registry, not the client.
    const task = INITIATION_TASKS.find((t) => t.id === taskId);
    if (!task) return err("Unknown task", 400);
    const signal = task.signal;

    const userInitRef = db.collection("user_initiation").doc(uid);
    const userRef     = db.collection("users").doc(uid);

    // Atomically: mark approved + record the task (idempotent) + credit signal.
    let credited = false;
    await db.runTransaction(async (tx) => {
      const [initSnap, apprSnap] = await Promise.all([
        tx.get(userInitRef),
        tx.get(approvalRef),
      ]);

      // Re-check status inside the tx to prevent double-approval races.
      const st = apprSnap.data()?.status as string | undefined;
      if (st && st !== "pending") return;

      const initData = initSnap.exists ? initSnap.data()! : {};
      const already  = !!initData[taskId];

      tx.set(approvalRef, {
        status:     "approved",
        reviewedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Non-repeatable task already recorded → approve the submission but
      // don't double-credit signal.
      if (already && !task.repeatable) return;

      tx.set(userInitRef, {
        [taskId]: { taskId, signal, txHash: null, timestamp: Date.now(), approved: true },
      }, { merge: true });

      tx.set(userRef, {
        signalWeight: FieldValue.increment(signal),
        updatedAt:    FieldValue.serverTimestamp(),
      }, { merge: true });

      credited = true;
    });

    // Activity feed (Admin SDK bypasses the client-only "join" restriction).
    if (credited) {
      const name = (await userRef.get()).data()?.displayName
        || `${uid.slice(0, 6)}…`;
      await db.collection("activity").add({
        type:        "initiation",
        displayName: name,
        mission:     task.title,
        badge:       task.badge || "",
        signal,
        timestamp:   FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ success: true, status: "approved", credited, signal });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Not authorized") || msg.includes("Missing"))
      return err("Forbidden", 403);
    console.error("[admin/approvals]", msg);
    return err("Internal error", 500);
  }
}

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
