import InputForm from './components/InputForm';
import ReportView from './components/ReportView';
import { useCompare } from './hooks/useCompare';

export default function App() {
  const { data, loading, error, compare } = useCompare();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 py-6 md:py-10 px-3 md:px-4">
      {!data && <InputForm onSubmit={compare} loading={loading} />}

      {error && (
        <div className="max-w-2xl mx-auto mt-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-center">
          {error}
        </div>
      )}

      {data && (
        <>
          <ReportView data={data} />

          {/* フローティング「新しい比較」ボタン */}
          <button
            onClick={() => window.location.reload()}
            className="fixed bottom-4 right-4 md:bottom-6 md:right-6 bg-white shadow-lg rounded-full px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:shadow-xl transition-all border border-gray-200 z-50 cursor-pointer"
          >
            &#x1f504; 新しい比較をする
          </button>
        </>
      )}
    </div>
  );
}
