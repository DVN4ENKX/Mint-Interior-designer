import Toolbar from './components/Toolbar'
import PlanPanel from './components/PlanPanel'
import ViewportPanel from './components/ViewportPanel'
import CatalogPanel from './components/CatalogPanel'

export default function App() {
  return (
    <div className="app">
      <Toolbar />
      <main className="panels">
        <PlanPanel />
        <ViewportPanel />
        <CatalogPanel />
      </main>
    </div>
  )
}