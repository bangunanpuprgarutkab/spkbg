export default function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-16 w-16 border-4 border-government-green border-t-transparent"></div>
      <p className="mt-4 text-gray-600 font-medium">Memuat aplikasi...</p>
    </div>
  )
}
