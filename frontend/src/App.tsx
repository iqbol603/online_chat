import ChatWidget from './components/ChatWidget';
import './App.css';

function App() {
  return (
    <div className="App">
      <div style={{ padding: '20px' }}>
        <h1>Добро пожаловать!</h1>
        <p>Нажмите на кнопку чата внизу справа, чтобы начать общение.</p>
      </div>
      <ChatWidget />
    </div>
  );
}

export default App;

