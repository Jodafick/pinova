import { ref } from 'vue'

/** Modal plein écran : aperçu reçu (iframe) + bouton télécharger. */
export function useBillingReceiptPdfModal() {
  const receiptPdfOpen = ref(false)
  const receiptPdfUrl = ref<string | null>(null)

  function closeReceiptPdf() {
    receiptPdfOpen.value = false
    receiptPdfUrl.value = null
  }

  function openReceiptPdf(url: string | null | undefined) {
    if (!url) return
    receiptPdfUrl.value = url
    receiptPdfOpen.value = true
  }

  return { receiptPdfOpen, receiptPdfUrl, closeReceiptPdf, openReceiptPdf }
}
