import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create your SyndiCheck account",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-blue-600">SyndiCheck</h1>
          </Link>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Sign in
            </Link>
          </p>
        </div>
        <SignupForm />
        <p className="text-center text-xs text-gray-500">
          By creating an account, you agree to our Terms of Service and Privacy
          Policy. SyndiCheck is for informational purposes only and does not
          provide investment advice.
        </p>
      </div>
    </div>
  );
}
