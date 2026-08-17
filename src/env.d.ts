/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    userId: string | null
    currency: string
    locale: string
  }
}
