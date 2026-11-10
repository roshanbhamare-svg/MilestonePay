import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import PayPalCheckout from './components/PayPalCheckout'

function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#f8fafc',
      gap: '24px',
    }}>
      <h1 style={{ fontSize: '36px', fontWeight: '700', margin: 0 }}>MilestonePay</h1>
      <p style={{ color: '#94a3b8', margin: 0 }}>AI-Powered Milestone-Based Payment Platform</p>
      <Link
        to="/checkout"
        style={{
          backgroundColor: '#1d4ed8',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '14px',
        }}
      >
        Test PayPal Integration →
      </Link>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/checkout" element={<PayPalCheckout />} />
        {/* Placeholder routes for Member C's future pages */}
        <Route path="/payment/success" element={<div style={{ color: '#fff', padding: '40px' }}>Payment success (placeholder)</div>} />
        <Route path="/payment/cancel" element={<div style={{ color: '#fff', padding: '40px' }}>Payment cancelled (placeholder)</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
