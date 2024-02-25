// webhook to connect stripe to our code and access our code
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { headers } from "next/headers"
import { NextResponse } from "next/server";

// post request
export async function POST(req: Request) {
    // get body and signature
    const body = await req.text();
    const signature = req.headers.get("Stripe-Signature") as string;

    // construct event
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        )
    } catch (error: any) {
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
    }

    // get session, userId, and courseId
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session?.metadata?.userId;
    const courseId = session?.metadata?.courseId;

    // if session is completed, send message
    if (event.type === "checkout.session.completed") {
        if(!userId || !courseId) {
            return new NextResponse(`Webhook Error: Missing metadata`, { status: 400 });
        }
        // create purchase in database
        await db.purchase.create({
            data: {
                courseId: courseId,
                userId: userId,
            }
        });
    } else {
        return new NextResponse(`Webhook Error: Unsupported event type ${event.type}`, { status: 200 });
    }

    return new NextResponse(null, { status: 200 });
}