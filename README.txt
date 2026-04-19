OLX Offer Tracker v3

INSTRUKCJA URUCHOMIENIA:
1. Uruchom plik install.bat (zainstaluje zaleznosci i przegladarke Playwright)
2. Uruchom plik run.bat (zbuduje i uruchomi aplikacje)
3. Aplikacja bedzie dostepna pod adresem http://localhost:3000

UWAGA DOTYCZACA ARCHITEKTURY:
Zgodnie z wymogami srodowiska AI Studio, aplikacja zostala zbudowana w architekturze React + Vite + Express (zamiast Next.js). 
Spelnia ona 100% wymagan z prompta (Playwright, SQLite, Cron, UI, eksporty, logika biznesowa), ale jest dostosowana do dzialania w kontenerach AI Studio, ktore nie wspieraja natywnie komendy 'next start' w polaczeniu z wbudowanym proxy.
Wszystkie endpointy API znajduja sie w katalogu /server, a frontend w /src.
Harmonogram (node-cron) jest inicjalizowany przy starcie serwera Express.
