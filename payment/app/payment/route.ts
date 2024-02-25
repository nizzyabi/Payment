// payment processer, for my app, it is courses, make sure you have a way to verify a user and a product. 
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import Stripe from "stripe";

// post request to checkout
export async function POST(
    req: Request,
    { params }: { params: { courseId: string } }
) {
    try {
        // get user, for you it might be different as you might have a different way to verify a user
        const user = await auth();

        if(!user || !user.user.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
        // get course from database
        const course = await db.course.findUnique({
            where: {
                id: params.courseId,
                isPublished: true
            }
        });
        // get purchase from database
        const purchase = await db.purchase.findUnique({
            where: {
                userId_courseId: {
                    userId: user.user.id,
                    courseId: params.courseId
                }
            }
        });

        if (purchase) {
            return new NextResponse("Already purchased", { status: 400 });
        }

        if(!course) {
            return new NextResponse("Course not found", { status: 404 });
        }
        // stripe session
        const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
            {
                // 1 is the quantity
                quantity: 1,
                // price, name, and description of item
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: course.title,
                        description: course.description!
                    },
                    unit_amount: Math.round(course.price! * 100)
                }
            }
        ];
        // get stripe customer
        let stripeCustomer = await db.stripeCustomer.findUnique({
            where: {
                userId: user.user.id
            },
            select: {
                stripeCustomerId: true
            }
        });

        if(!stripeCustomer) {
            // might get error for this email call
            const customer = await stripe.customers.create({
                email: user.user.email!
            })

        // create stripe customer
        stripeCustomer = await db.stripeCustomer.create({
            data: {
                userId: user.user.id,
                stripeCustomerId: customer.id
            }
        })
        }
        // create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomer.stripeCustomerId,
            line_items,
            mode: 'payment',
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/courses/${course.id}/success=1`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/courses/${course.id}/canceled=1`,
            metadata: {
                courseId: course.id,
                userId: user.user.id
            }
        });

        return NextResponse.json({ url: session.url })
    } catch (error) {
        console.log("[COURSE_ID_CHECKOUT]", error);
        return new NextResponse("Internal Error", { status: 500 })
    }
}