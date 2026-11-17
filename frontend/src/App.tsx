import { AuthGate } from './auth/AuthGate'
import { CategoriesPage } from './components/categories/CategoriesPage'
import { CategoryDetailPage } from './components/testMaster/CategoryDetailPage'
import { ToastProvider } from './components/ui/ToastProvider'
import { useHashRoute } from './hooks/useHashRoute'

function Routes() {
  const { route } = useHashRoute()
  return route.name === 'category' ? (
    <CategoryDetailPage key={route.categoryId} categoryId={route.categoryId} />
  ) : (
    <CategoriesPage />
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthGate>
        <Routes />
      </AuthGate>
    </ToastProvider>
  )
}
