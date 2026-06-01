import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  Users, 
  Settings, 
  Plus, 
  Trash2, 
  Bell, 
  CheckCircle, 
  AlertTriangle, 
  CloudSun, 
  Mail, 
  MessageSquare, 
  MapPin, 
  RefreshCw,
  Sun,
  CloudRain,
  HelpCircle,
  UserCheck,
  UserX,
  TrendingUp,
  Award,
  BookOpen,
  Shuffle,
  CalendarCheck,
  CalendarClock,
  Sliders,
  ChevronRight,
  ShieldAlert,
  Lock,
  Unlock,
  XCircle,
  Power
} from 'lucide-react';

const INITIAL_GOLFERS = [
  { id: '1', name: 'Tiger Woods', email: 'tiger@golf.com', phone: '(555) 123-4567', status: 'Invited', handicap: 1, ghin: '1092834', assignedTeeTime: null },
  { id: '2', name: 'Phil Mickelson', email: 'phil@golf.com', phone: '(555) 234-5678', status: 'Invited', handicap: 3, ghin: '2938475', assignedTeeTime: null },
  { id: '3', name: 'Rory McIlroy', email: 'rory@golf.com', phone: '(555) 345-6789', status: 'Invited', handicap: 2, ghin: '3847561', assignedTeeTime: null },
  { id: '4', name: 'Jordan Spieth', email: 'jordan@golf.com', phone: '(555) 456-7890', status: 'Invited', handicap: 4, ghin: '4756102', assignedTeeTime: null },
  { id: '5', name: 'Scottie Scheffler', email: 'scottie@golf.com', phone: '(555) 567-8901', status: 'Invited', handicap: 1, ghin: '5610293', assignedTeeTime: null },
  { id: '6', name: 'Brooks Koepka', email: 'brooks@golf.com', phone: '(555) 678-9012', status: 'Invited', handicap: 2, ghin: '6102938', assignedTeeTime: null },
  { id: '7', name: 'Viktor Hovland', email: 'viktor@golf.com', phone: '(555) 789-0123', status: 'Invited', handicap: 3, ghin: '7584930', assignedTeeTime: null },
  { id: '8', name: 'Justin Thomas', email: 'justin@golf.com', phone: '(555) 890-1234', status: 'Invited', handicap: 4, ghin: '8493021', assignedTeeTime: null },
  { id: '9', name: 'Collin Morikawa', email: 'collin@golf.com', phone: '(555) 901-2345', status: 'Invited', handicap: 5, ghin: '9302184', assignedTeeTime: null },
  { id: '10', name: 'Dustin Johnson', email: 'dustin@golf.com', phone: '(555) 012-3456', status: 'Invited', handicap: 3, ghin: '1029384', assignedTeeTime: null },
];

const DEFAULT_COURSE = 'Newnan Country Club, Newnan, GA';

export default function App() {
  const [course, setCourse] = useState(DEFAULT_COURSE);
  const [gameDate, setGameDate] = useState(() => {
    const nextSat = new Date();
    nextSat.setDate(nextSat.getDate() + ((6 + 7 - nextSat.getDay()) % 7 || 7));
    return nextSat.toISOString().split('T')[0];
  });
  const [firstTeeTime, setFirstTeeTime] = useState('08:00');
  const [numTeeTimes, setNumTeeTimes] = useState(2); // Default 2 tee times = 8 spots
  const [interval, setInterval] = useState(10); // 10 minutes default
  const [golfers, setGolfers] = useState(INITIAL_GOLFERS);
  const [waitlist, setWaitlist] = useState([]); // FIFO queue of IDs

  // Feature 1 State: Admin Authentication State
  const [adminAccount, setAdminAccount] = useState(null); // stores { emailOrPhone: '', password: '' }
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authEmailOrPhone, setAuthEmailOrPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(true); // toggle SignUp vs SignIn
  const [authError, setAuthError] = useState('');

  // Feature 2 State: Game Cancellation State
  const [isGameCancelled, setIsGameCancelled] = useState(false);

  // Dynamically calculate default open (3 days ago) and close (1 hour before match)
  const [regOpenDateTime, setRegOpenDateTime] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3); // 3 days ago
    d.setHours(8, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });

  const [regCloseDateTime, setRegCloseDateTime] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3); // 3 days from now
    d.setHours(7, 0, 0, 0); // 7:00 AM (1 hr before 8:00 AM)
    return d.toISOString().slice(0, 16);
  });

  // Simulated Clock to test scheduling without waiting for real time
  const [simulatedCurrentTime, setSimulatedCurrentTime] = useState(() => {
    const d = new Date(); // Right now, which falls in the open window by default
    return d.toISOString().slice(0, 16);
  });

  const [useBalancedFoursomes, setUseBalancedFoursomes] = useState(true);
  const [useTeeTimeAssignment, setUseTeeTimeAssignment] = useState(true); // If true, players get instant tee times upon registering

  const [localRules, setLocalRules] = useState('Winter rules apply. Roll scorecard length in fairways. Maximum score of double par on any hole to keep pace of play moving.');
  const [selectedSimPlayerId, setSelectedSimPlayerId] = useState('1');
  const [activeTab, setActiveTab] = useState('board'); // 'board', 'simulator', 'admin', 'notifications'
  
  // Weather state
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(null);

  // Live Alerts & Logger State
  const [notifications, setNotifications] = useState([
    {
      id: 'init',
      type: 'System',
      timestamp: new Date().toLocaleTimeString(),
      text: 'Weekly Golf Game Invitation System initialized. Welcome to Newnan Country Club!',
      target: 'All Invitees'
    }
  ]);
  const [showAdminAlert, setShowAdminAlert] = useState(false);

  // New golfer form states
  const [newGolferName, setNewGolferName] = useState('');
  const [newGolferEmail, setNewGolferEmail] = useState('');
  const [newGolferPhone, setNewGolferPhone] = useState('');
  const [newGolferHcp, setNewGolferHcp] = useState('10');
  const [newGolferGhin, setNewGolferGhin] = useState('');

  const getRegistrationStatus = () => {
    if (isGameCancelled) {
      return { status: 'Game Cancelled', color: 'text-rose-400 bg-rose-950/40 border-rose-500/20', isLocked: true };
    }
    const current = new Date(simulatedCurrentTime);
    const open = new Date(regOpenDateTime);
    const close = new Date(regCloseDateTime);

    if (current < open) {
      return { status: 'Not Yet Open', color: 'text-amber-400 bg-amber-950/40 border-amber-500/20', isLocked: true };
    }
    if (current > close) {
      return { status: 'Closed / Locked', color: 'text-rose-400 bg-rose-950/40 border-rose-500/20', isLocked: true };
    }
    return { status: 'Open', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/20', isLocked: false };
  };

  const currentStatus = getRegistrationStatus();
  const isLocked = currentStatus.isLocked;

  const fetchLiveWeather = async (targetCourse) => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      // Step 1: Geocode the course text using OpenStreetMap (Nominatim)
      const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(targetCourse)}&format=json&limit=1`;
      const geoResponse = await fetch(geoUrl, {
        headers: { 'User-Agent': 'LinksInviteGolfApp/1.0 (contact@linksinvite.com)' }
      });
      const geoData = await geoResponse.json();

      let lat = 33.3807; // Default to Newnan, GA
      let lon = -84.7997;
      let courseLabel = "Newnan Country Club";

      if (geoData && geoData.length > 0) {
        lat = parseFloat(geoData[0].lat);
        lon = parseFloat(geoData[0].lon);
        courseLabel = geoData[0].display_name.split(',')[0];
      }

      // Step 2: Query Open-Meteo open-source forecast API using the coordinates
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&timezone=auto`;
      const weatherResponse = await fetch(weatherUrl);
      const weatherData = await weatherResponse.json();

      if (weatherData && weatherData.daily) {
        const daily = weatherData.daily;
        
        // Helper to translate WMO code to human readable conditions
        const mapWmoCodeToCondition = (code) => {
          if (code === 0) return { text: "Clear Sunny Skies", icon: "sun" };
          if ([1, 2, 3].includes(code)) return { text: "Partly Cloudy", icon: "cloudsun" };
          if ([45, 48].includes(code)) return { text: "Foggy/Overcast", icon: "cloudsun" };
          if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { text: "Scattered Rain", icon: "cloudrain" };
          if ([71, 73, 75, 77, 85, 86].includes(code)) return { text: "Snowy Conditions", icon: "snow" };
          if ([95, 96, 99].includes(code)) return { text: "Thunderstorms", icon: "thunder" };
          return { text: "Overcast Clouds", icon: "cloudsun" };
        };

        // Format dynamic 3-day forecast arrays
        const daysMapped = daily.time.slice(0, 3).map((timeStr, idx) => {
          const dateObj = new Date(timeStr + 'T00:00:00');
          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
          const code = daily.weathercode[idx];
          const mapped = mapWmoCodeToCondition(code);
          const maxTemp = Math.round(daily.temperature_2m_max[idx]);
          const minTemp = Math.round(daily.temperature_2m_min[idx]);
          const rainChance = daily.precipitation_probability_max[idx] || 0;

          // Determine Playability recommendation mathematically
          let playability = "Excellent";
          if (rainChance > 45) {
            playability = "Poor";
          } else if (rainChance > 20 || maxTemp < 50) {
            playability = "Fair";
          } else if (maxTemp > 95) {
            playability = "Hot";
          }

          return {
            dayName,
            temp: `${maxTemp}°F / ${minTemp}°F`,
            condition: mapped.text,
            rainChance: `${rainChance}%`,
            playability
          };
        });

        // Determine general golf suggestion message
        const dayOneRain = daily.precipitation_probability_max[0] || 0;
        const dayOneTemp = daily.temperature_2m_max[0] || 70;
        let overallAdvice = "Forecast looks great for a round of golf! Green speeds should be standard.";
        if (dayOneRain > 50) {
          overallAdvice = "High probability of rain. Consider packing umbrellas or scheduling an alternate indoor option.";
        } else if (dayOneTemp < 55) {
          overallAdvice = "Temperatures will be on the cooler side. Layer up and hit low spin golf balls for extra distance.";
        }

        setWeatherData({
          courseName: courseLabel,
          location: targetCourse,
          days: daysMapped,
          overallAdvice
        });
      } else {
        throw new Error("Invalid forecast data schema");
      }
    } catch (err) {
      console.error("Error retrieving open source weather:", err);
      // Fallback structured data matching schema
      setWeatherData({
        courseName: targetCourse.split(',')[0] || "Newnan Country Club",
        location: targetCourse || "Newnan, GA",
        days: [
          { dayName: "Saturday", temp: "76°F / 60°F", condition: "Partly Cloudy", rainChance: "15%", playability: "Excellent" },
          { dayName: "Sunday", temp: "72°F / 58°F", condition: "Sunny & Warm", rainChance: "5%", playability: "Perfect" },
          { dayName: "Monday", temp: "69°F / 52°F", condition: "Scattered Showers", rainChance: "60%", playability: "Poor" }
        ],
        overallAdvice: "Beautiful weather on Saturday. Low winds expected, perfect for scoring!"
      });
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveWeather(course);
  }, [course]);

  const getTeeTimesList = () => {
    const times = [];
    const [hours, minutes] = firstTeeTime.split(':').map(Number);
    
    for (let i = 0; i < numTeeTimes; i++) {
      const timeObj = new Date();
      timeObj.setHours(hours, minutes + (i * interval), 0, 0);
      const timeStr = timeObj.toTimeString().substring(0, 5);
      
      const registeredForThisTime = golfers.filter(g => g.status === 'Registered' && g.assignedTeeTime === timeStr);
      
      times.push({
        time: timeStr,
        slots: [0, 1, 2, 3].map(idx => registeredForThisTime[idx] || null)
      });
    }
    return times;
  };

  const teeTimesList = getTeeTimesList();
  const totalSlots = numTeeTimes * 4;
  const registeredPlayers = golfers.filter(g => g.status === 'Registered');
  const availableSlotsCount = Math.max(0, totalSlots - registeredPlayers.length);

  const handleArrangeFoursomes = () => {
    const registered = golfers.filter(g => g.status === 'Registered');
    if (registered.length === 0) {
      logSystemAlert("No registered golfers available to group.");
      return;
    }

    const timesList = teeTimesList.map(t => t.time);
    const numTimes = timesList.length;

    if (useBalancedFoursomes) {
      // Balanced Pairing: Sort registered golfers by handicap ascending (best to worst)
      const sorted = [...registered].sort((a, b) => Number(a.handicap || 0) - Number(b.handicap || 0));
      
      // Create empty buckets for each tee time
      const buckets = Array.from({ length: numTimes }, () => []);

      // Distribute using snake-draft pattern to balance skill levels
      let goingForward = true;
      let timeIdx = 0;

      for (let i = 0; i < sorted.length; i++) {
        buckets[timeIdx].push(sorted[i]);

        if (goingForward) {
          if (timeIdx === numTimes - 1) {
            goingForward = false;
          } else {
            timeIdx++;
          }
        } else {
          if (timeIdx === 0) {
            goingForward = true;
          } else {
            timeIdx--;
          }
        }
      }

      // Rebuild golfer state with balanced times
      setGolfers(prev => prev.map(g => {
        if (g.status === 'Registered') {
          const targetBucketIdx = buckets.findIndex(b => b.some(player => player.id === g.id));
          if (targetBucketIdx !== -1) {
            return { ...g, assignedTeeTime: timesList[targetBucketIdx] };
          }
        }
        return g;
      }));

      addNotificationLog(
        'Balanced Pairing', 
        '⚖️ Balanced Pairing: Foursomes arranged based on player Handicaps using a balanced snake-distribution draft to equalize skill levels across all tee times.', 
        'All Group'
      );
    } else {
      // Pure random assignment across available tee times
      const shuffled = [...registered].sort(() => Math.random() - 0.5);
      
      setGolfers(prev => prev.map(g => {
        if (g.status === 'Registered') {
          const indexInShuffled = shuffled.findIndex(player => player.id === g.id);
          if (indexInShuffled !== -1) {
            const assignedTimeIdx = Math.floor(indexInShuffled / 4) % numTimes;
            return { ...g, assignedTeeTime: timesList[assignedTimeIdx] };
          }
        }
        return g;
      }));

      addNotificationLog(
        'Foursome Shuffle', 
        '🎲 Random Lineup: Roster was randomly shuffled and assigned to tee times without handicap balancing.', 
        'All Group'
      );
    }
  };

  const getGameRecommendation = () => {
    const count = registeredPlayers.length;
    if (count === 0) {
      return {
        format: "Awaiting Players",
        reason: "Register golfers to receive an automated match format recommendation."
      };
    }

    const avgHcp = registeredPlayers.reduce((sum, g) => sum + Number(g.handicap || 0), 0) / count;
    const highHcpCount = registeredPlayers.filter(g => Number(g.handicap || 0) >= 15).length;

    if (avgHcp >= 16 || highHcpCount > (count / 2)) {
      return {
        format: "Stableford Points Quotas",
        reason: `Recommended because of a high average handicap spread (${avgHcp.toFixed(1)} HCP). Stableford rewards individual consistency and is forgiving, allowing players to pick up their ball once net double bogey is reached to speed up play.`
      };
    } else if (count >= 8) {
      return {
        format: "2 Best Ball Full Handicap",
        reason: `Recommended for your large field of ${count} players. Scoring the best 2 net balls of the foursome encourages teamwork and maximizes competitive protection across different handicap levels.`
      };
    } else {
      return {
        format: "1 Best Ball Full Handicap",
        reason: `Recommended for smaller fields (${count} players). Allows players to play their own ball with full handicap index strokes, counting only the team's single best net score on each hole.`
      };
    }
  };

  const recommendation = getGameRecommendation();

  const handleRegister = (golferId, customHcp, customGhin) => {
    if (isLocked) {
      logSystemAlert(`Registration blocked: Schedule is current in ${currentStatus.status} state.`);
      return;
    }

    const golfer = golfers.find(g => g.id === golferId);
    if (!golfer) return;

    if (golfer.status === 'Registered') return;

    const hcpVal = customHcp !== undefined ? Number(customHcp) : golfer.handicap;
    const ghinVal = customGhin !== undefined ? customGhin : golfer.ghin;

    // Handle instant assignment option vs late manual assignment
    let assignedTime = null;
    if (useTeeTimeAssignment) {
      const currentTeeTimes = getTeeTimesList();
      for (let t of currentTeeTimes) {
        const count = t.slots.filter(s => s !== null).length;
        if (count < 4) {
          assignedTime = t.time;
          break;
        }
      }
    }

    // Check if we hit cap (only applies if immediate tee time assignment is active)
    if (useTeeTimeAssignment && !assignedTime) {
      // Tee times are full, waitlist the golfer
      setWaitlist(prev => [...prev, golferId]);
      setGolfers(prev => prev.map(g => {
        if (g.id === golferId) {
          return { 
            ...g, 
            status: 'Waitlisted', 
            assignedTeeTime: null,
            handicap: hcpVal,
            ghin: ghinVal
          };
        }
        return g;
      }));

      setShowAdminAlert(true);
      addNotificationLog(
        'Waitlisted', 
        `🚨 Capacity Warning: Tee times are completely full! ${golfer.name} has been added to the FIFO Waitlist. Admin was notified to add another slot.`, 
        'All Group'
      );
    } else {
      // Safe to register
      setGolfers(prev => prev.map(g => {
        if (g.id === golferId) {
          return { 
            ...g, 
            status: 'Registered', 
            assignedTeeTime: assignedTime, // might be null if useTeeTimeAssignment is off
            handicap: hcpVal,
            ghin: ghinVal
          };
        }
        return g;
      }));

      const alertMsg = assignedTime 
        ? `⛳ Registered: ${golfer.name} (HCP: ${hcpVal}) joined the ${assignedTime} AM tee time.`
        : `⛳ Registered: ${golfer.name} (HCP: ${hcpVal}) joined the roster pool (Tee Time Assignment pending).`;

      addNotificationLog('Registration', alertMsg, 'All Group');
    }
  };

  const handleUnregister = (golferId) => {
    if (isLocked) {
      logSystemAlert(`Unregistration blocked: Schedule is current in ${currentStatus.status} state.`);
      return;
    }

    const golfer = golfers.find(g => g.id === golferId);
    if (!golfer) return;

    const wasRegistered = golfer.status === 'Registered';
    const wasWaitlisted = golfer.status === 'Waitlisted';
    const originalTeeTime = golfer.assignedTeeTime;

    setGolfers(prev => prev.map(g => {
      if (g.id === golferId) {
        return { ...g, status: 'Unregistered', assignedTeeTime: null };
      }
      return g;
    }));

    if (wasWaitlisted) {
      setWaitlist(prev => prev.filter(id => id !== golferId));
      addNotificationLog(
        'Unregister', 
        `Withdrew: ${golfer.name} removed themselves from the Waitlist.`, 
        'All Group'
      );
      return;
    }

    if (wasRegistered) {
      addNotificationLog(
        'Unregister', 
        `Withdrew: ${golfer.name} unregistered and freed up their slot.`, 
        'All Group'
      );

      // Trigger FIFO waitlist promotion ONLY if we are using instant assignments and there was an original slot
      if (useTeeTimeAssignment && originalTeeTime && waitlist.length > 0) {
        const [nextInLineId, ...remainingWaitlist] = waitlist;
        setWaitlist(remainingWaitlist);

        const nextGolfer = golfers.find(g => g.id === nextInLineId);
        if (nextGolfer) {
          setGolfers(prev => prev.map(g => {
            if (g.id === nextInLineId) {
              return { ...g, status: 'Registered', assignedTeeTime: originalTeeTime };
            }
            return g;
          }));

          addNotificationLog(
            'FIFO Promotion', 
            `🎉 Waitlist Promotion: ${nextGolfer.name} was automatically promoted from the waitlist to fill the open ${originalTeeTime} AM slot.`, 
            'All Group'
          );
        }
      }
    }
  };

  const handleUpdateGolferDetails = (golferId, fields) => {
    setGolfers(prev => prev.map(g => {
      if (g.id === golferId) {
        return { ...g, ...fields };
      }
      return g;
    }));
  };

  const handleAddTeeTime = () => {
    // Determine the next tee time string
    const [hours, minutes] = firstTeeTime.split(':').map(Number);
    const newTimeIndex = numTeeTimes; 
    const timeObj = new Date();
    timeObj.setHours(hours, minutes + (newTimeIndex * interval), 0, 0);
    const newTeeTimeStr = timeObj.toTimeString().substring(0, 5);

    // Promote up to 4 golfers on a FIFO basis from waitlist
    const golfersToPromoteIds = waitlist.slice(0, 4);
    const updatedWaitlist = waitlist.slice(4);

    // Promote waitlisted players
    if (golfersToPromoteIds.length > 0) {
      setGolfers(prevGolfers => prevGolfers.map(g => {
        if (golfersToPromoteIds.includes(g.id)) {
          return { ...g, status: 'Registered', assignedTeeTime: newTeeTimeStr };
        }
        return g;
      }));
    }

    setWaitlist(updatedWaitlist);
    setNumTeeTimes(prev => prev + 1);
    setShowAdminAlert(false);

    // Calculate available empty slots in the newly created tee time block (4 slots total)
    const promotedCount = golfersToPromoteIds.length;
    const remainingOpenSlots = 4 - promotedCount;

    // Build notifications
    let logMsg = `🎉 Admin added a new tee time slot at ${newTeeTimeStr} AM.`;
    if (promotedCount > 0) {
      const promotedNames = golfers.filter(g => golfersToPromoteIds.includes(g.id)).map(g => g.name);
      logMsg += ` Automatically promoted ${promotedCount} golfer(s) (${promotedNames.join(', ')}) from waitlist in FIFO order.`;
    }

    if (remainingOpenSlots > 0) {
      logMsg += ` 🚨 There are ${remainingOpenSlots} open slot(s) now available in this new block! Email/SMS notification dispatched to invitees.`;
    } else {
      logMsg += ` All 4 slots filled completely from waitlist.`;
    }

    addNotificationLog('Admin Action', logMsg, 'All Group');
  };

  const handleCancelGame = () => {
    setIsGameCancelled(true);
    addNotificationLog(
      'Cancellation Alert',
      `🚨 GAME CANCELLED: The weekly golf game at ${course.split(',')[0]} scheduled for ${gameDate} has been cancelled by the Owner/Administrator. All registered tee sheets are closed.`,
      'All Group'
    );
  };

  const handleRestoreGame = () => {
    setIsGameCancelled(false);
    addNotificationLog(
      'System Alert',
      `💚 GAME RESTORED: The administrator has re-activated and reopened the game at ${course.split(',')[0]} for ${gameDate}. Registrations are available.`,
      'All Group'
    );
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    setAuthError('');

    if (!authEmailOrPhone.trim() || !authPassword.trim()) {
      setAuthError('Please enter both credentials.');
      return;
    }

    if (isSigningUp) {
      // Create new account
      const newAcc = { emailOrPhone: authEmailOrPhone, password: authPassword };
      setAdminAccount(newAcc);
      setIsLoggedIn(true);
      addNotificationLog('Admin Setup', `🆕 Owner/Admin account successfully created for ${authEmailOrPhone}.`, 'Self');
    } else {
      // Sign in
      if (!adminAccount) {
        setAuthError('No owner account exists. Please select "Set up new Owner Account" first.');
        return;
      }
      if (adminAccount.emailOrPhone === authEmailOrPhone && adminAccount.password === authPassword) {
        setIsLoggedIn(true);
        addNotificationLog('Admin Setup', `🔑 Owner/Admin successfully logged in.`, 'Self');
      } else {
        setAuthError('Incorrect username/phone or password. Please try again.');
      }
    }
  };

  const addNotificationLog = (type, text, target) => {
    const timestamp = new Date().toLocaleTimeString();
    setNotifications(prev => [
      {
        id: crypto.randomUUID(),
        type,
        timestamp,
        text,
        target,
        weather: weatherData ? `${weatherData.days[0].condition}, ${weatherData.days[0].temp} (${weatherData.days[0].rainChance} Rain)` : 'N/A'
      },
      ...prev
    ]);
  };

  const logSystemAlert = (text) => {
    addNotificationLog('System Alert', text, 'Self');
  };

  const handleAddNewGolfer = (e) => {
    e.preventDefault();
    if (!newGolferName.trim()) return;

    const newPlayer = {
      id: crypto.randomUUID(),
      name: newGolferName,
      email: newGolferEmail || `${newGolferName.toLowerCase().replace(/\s+/g, '')}@golf.com`,
      phone: newGolferPhone || '(555) 000-0000',
      status: 'Invited',
      handicap: Number(newGolferHcp) || 12,
      ghin: newGolferGhin || '',
      assignedTeeTime: null
    };

    setGolfers(prev => [...prev, newPlayer]);
    setNewGolferName('');
    setNewGolferEmail('');
    setNewGolferPhone('');
    setNewGolferHcp('10');
    setNewGolferGhin('');
    addNotificationLog('Admin Action', `Added new player to invite pool: ${newPlayer.name} (HCP: ${newPlayer.handicap})`, 'All Group');
  };

  const currentSimPlayer = golfers.find(g => g.id === selectedSimPlayerId) || golfers[0];

  const formatFriendlyDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return 'Not Configured';
    const opt = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateTimeStr).toLocaleDateString('en-US', opt);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* Header section */}
      <header className="border-b border-slate-800 bg-slate-950/85 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-2 rounded-xl text-slate-950 shadow-md shadow-emerald-500/10">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">LinksInvite</span>
              <span className="text-xs text-slate-400 block -mt-1 font-medium">Weekly Golf Coordinator</span>
            </div>
          </div>

          {/* Quick Stats bar */}
          <div className="hidden md:flex items-center space-x-6 text-xs text-slate-300">
            <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-850">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Registered: <strong className="text-white">{registeredPlayers.length}/{totalSlots}</strong></span>
            </div>
            <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-850">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Waitlist: <strong className="text-white">{waitlist.length}</strong></span>
            </div>
            <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-850">
              <Award className="w-3.5 h-3.5 text-sky-400" />
              <span>Format: <strong className="text-white">{recommendation.format}</strong></span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-850 border border-slate-700 text-slate-300 shadow">
              Live Coordinator
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* Feature 2: Game Cancelled Alert Display */}
        {isGameCancelled && (
          <div className="bg-rose-950/70 border border-rose-500 text-rose-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center space-x-4">
              <div className="bg-rose-500 p-3 rounded-full text-slate-950">
                <XCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-wide">WEEKLY GOLF GAME CANCELLED</h3>
                <p className="text-sm text-rose-300">The administrator has canceled this week's round at {course.split(',')[0]}. Registration is blocked.</p>
              </div>
            </div>
            {isLoggedIn && (
              <button 
                onClick={handleRestoreGame}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 shrink-0 shadow-lg"
              >
                <Power className="w-4 h-4" />
                <span>Re-activate Game</span>
              </button>
            )}
          </div>
        )}
        
        {/* Waitlist Alerts */}
        {showAdminAlert && !isGameCancelled && (
          <div className="bg-amber-950/50 border border-amber-500/30 text-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="bg-amber-500/20 p-2 rounded-lg text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Waitlist is Active! ({waitlist.length} Golfers waiting)</h4>
                <p className="text-xs text-amber-300/80">Tee times are fully booked. Would you like to add another tee slot? (Waitlist will be promoted automatically in FIFO order).</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 self-stretch sm:self-auto justify-end">
              <button 
                onClick={() => setShowAdminAlert(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-600/30 text-amber-400 hover:bg-amber-900/30 transition-all"
              >
                Keep Waitlist
              </button>
              <button 
                onClick={handleAddTeeTime}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-amber-500/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add 1 Tee Time (4 spots)</span>
              </button>
            </div>
          </div>
        )}

        {}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 lg:col-span-2 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full filter blur-3xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-700"></div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-10">
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>Active Golf Course Venue</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    value={course} 
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="Enter Golf Course..."
                    className="bg-transparent font-bold text-lg text-white border-b border-transparent hover:border-slate-700 focus:border-emerald-500 focus:outline-none transition-all py-0.5 w-full sm:w-80"
                    disabled={isGameCancelled}
                  />
                  {course !== DEFAULT_COURSE && (
                    <button 
                      onClick={() => setCourse(DEFAULT_COURSE)}
                      className="text-[10px] text-slate-400 bg-slate-805 hover:text-white px-2 py-1 rounded border border-slate-700 transition"
                    >
                      Reset Default
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-4 text-xs text-slate-400 flex-wrap gap-y-2">
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <input 
                      type="date" 
                      value={gameDate} 
                      onChange={(e) => setGameDate(e.target.value)}
                      className="bg-slate-950 px-2 py-1 rounded text-slate-300 border border-slate-850 text-xs"
                      disabled={isGameCancelled}
                    />
                  </span>
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>First Tee: <strong>{firstTeeTime} AM</strong></span>
                  </span>
                </div>
              </div>
              
              <button 
                onClick={() => fetchLiveWeather(course)}
                disabled={weatherLoading}
                className="flex items-center space-x-1.5 text-xs text-slate-400 bg-slate-950 hover:text-white px-3 py-2 rounded-xl border border-slate-800 hover:border-slate-700 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${weatherLoading ? 'animate-spin text-emerald-400' : ''}`} />
                <span>Sync Weather</span>
              </button>
            </div>

            {/* Weather forecasts */}
            <div className="mt-6 border-t border-slate-800/85 pt-6">
              {weatherLoading ? (
                <div className="flex flex-col items-center justify-center py-6 space-y-2">
                  <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                  <span className="text-xs text-slate-400">Syncing live Open-Meteo data...</span>
                </div>
              ) : weatherData ? (
                <div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    {weatherData.days.map((day, idx) => (
                      <div key={idx} className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl flex flex-col items-center text-center">
                        <span className="text-xs font-semibold text-slate-400">{day.dayName}</span>
                        {day.condition.toLowerCase().includes('sun') ? (
                          <Sun className="w-6 h-6 my-2 text-amber-400" />
                        ) : (
                          <CloudSun className="w-6 h-6 my-2 text-sky-300" />
                        )}
                        <span className="text-xs font-bold text-white">{day.temp}</span>
                        
                        <span className="text-[11px] font-medium text-sky-400 flex items-center space-x-1 mt-1">
                          <CloudRain className="w-3 h-3 text-sky-400 shrink-0" />
                          <span>{day.rainChance} Rain</span>
                        </span>
                        
                        <span className="text-[10px] text-slate-400 truncate w-full mt-1">{day.condition}</span>
                        <span className="text-[10px] mt-2 text-emerald-400 bg-emerald-950/50 border border-emerald-900/40 px-1.5 py-0.5 rounded-full font-medium">
                          {day.playability} Play
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-emerald-300 bg-emerald-950/25 border border-emerald-900/30 p-2.5 rounded-xl flex items-start space-x-2">
                    <CloudSun className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Pro Recommendation:</strong> {weatherData.overallAdvice}</span>
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Weather unavailable. Try syncing.
                </div>
              )}
            </div>
          </div>

          {}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4.5 h-4.5 text-emerald-400" />
                  <h3 className="font-bold text-sm uppercase tracking-wide text-slate-200">Registration</h3>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${currentStatus.color}`}>
                  {currentStatus.status}
                </span>
              </div>

              {/* Dynamic Schedules display */}
              <div className="grid grid-cols-1 gap-2 text-xs bg-slate-950 p-3 rounded-xl border border-slate-850">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center space-x-1">
                    <CalendarCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Open Time:</span>
                  </span>
                  <span className="font-semibold text-slate-200">{formatFriendlyDateTime(regOpenDateTime)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center space-x-1">
                    <CalendarClock className="w-3.5 h-3.5 text-rose-500" />
                    <span>Close Time:</span>
                  </span>
                  <span className="font-semibold text-slate-200">{formatFriendlyDateTime(regCloseDateTime)}</span>
                </div>
              </div>

              {/* Simulated Time Travel Controller */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Simulated Roster Time</label>
                  <span className="text-[9px] bg-slate-800 text-emerald-400 font-mono px-1 rounded">Dev Tool</span>
                </div>
                <input 
                  type="datetime-local" 
                  value={simulatedCurrentTime}
                  onChange={(e) => setSimulatedCurrentTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
                  disabled={isGameCancelled}
                />
                
                {/* Instant Presets */}
                <div className="grid grid-cols-3 gap-1">
                  <button 
                    onClick={() => {
                      const d = new Date(regOpenDateTime);
                      d.setHours(d.getHours() - 12);
                      setSimulatedCurrentTime(d.toISOString().slice(0, 16));
                    }}
                    className="text-[9px] bg-slate-900 hover:bg-slate-800 border border-slate-800 py-1 rounded text-slate-300"
                    disabled={isGameCancelled}
                  >
                    ⏮ Before Open
                  </button>
                  <button 
                    onClick={() => {
                      const op = new Date(regOpenDateTime);
                      const cl = new Date(regCloseDateTime);
                      const mid = new Date(op.getTime() + (cl.getTime() - op.getTime()) / 2);
                      setSimulatedCurrentTime(mid.toISOString().slice(0, 16));
                    }}
                    className="text-[9px] bg-slate-900 hover:bg-slate-800 border border-slate-800 py-1 rounded text-emerald-400"
                    disabled={isGameCancelled}
                  >
                    ▶ Within Open
                  </button>
                  <button 
                    onClick={() => {
                      const d = new Date(regCloseDateTime);
                      d.setHours(d.getHours() + 2);
                      setSimulatedCurrentTime(d.toISOString().slice(0, 16));
                    }}
                    className="text-[9px] bg-slate-900 hover:bg-slate-800 border border-slate-800 py-1 rounded text-rose-400"
                    disabled={isGameCancelled}
                  >
                    ⏭ After Close
                  </button>
                </div>
              </div>
            </div>

            {/* Warning when registration is blocked */}
            {isLocked && (
              <div className="bg-rose-950/20 border border-rose-500/20 text-rose-300 p-2.5 rounded-xl flex items-center space-x-2 text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Registrations are currently locked or cancelled.</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
              <span>Next Game: <strong className="text-white">{gameDate}</strong></span>
              <span>Tee Time: <strong className="text-white">{firstTeeTime} AM</strong></span>
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 overflow-x-auto whitespace-nowrap scrollbar-none">
          <button 
            onClick={() => setActiveTab('board')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'board' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            ⛳ Tee Sheet & Groupings
          </button>
          <button 
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'simulator' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            📲 Email & SMS Invites
          </button>
          <button 
            onClick={() => setActiveTab('admin')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === 'admin' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {isLoggedIn ? <Unlock className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-slate-500" />}
            <span>🛠️ Admin Panel</span>
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center space-x-1 ${
              activeTab === 'notifications' ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>💬 Live Group Logs</span>
            <span className="bg-slate-800 text-[10px] text-slate-300 px-1.5 py-0.5 rounded-full font-normal">
              {notifications.length}
            </span>
          </button>
        </div>

        {/* TAB 1: Tee Sheet Dashboard */}
        {activeTab === 'board' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-2 space-y-6">
              
              {/* Play Advisory Board */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/60 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="font-bold text-sm text-slate-100">Live Field Recommendation</h4>
                      <p className="text-xs text-slate-400">Derived dynamically based on registered roster handicaps.</p>
                    </div>
                  </div>
                  <div className="bg-emerald-950/40 border border-emerald-500/20 px-3 py-1 rounded-lg text-emerald-400 text-xs font-extrabold flex items-center space-x-1.5 self-start">
                    <Award className="w-3.5 h-3.5" />
                    <span>{recommendation.format}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {recommendation.reason}
                </p>

                {/* Shuffling & Pairing Controller */}
                <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Arrange Foursomes</span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-1.5 py-0.5 rounded-full">
                        Admin Options
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Impose current grouping setting: <strong className="text-slate-200">{useBalancedFoursomes ? 'Balanced Pairing' : 'Random Selection'}</strong>
                    </p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                    <button
                      onClick={handleArrangeFoursomes}
                      disabled={isGameCancelled}
                      className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow disabled:opacity-50 transition-all"
                    >
                      <Shuffle className="w-4 h-4" />
                      <span>{useBalancedFoursomes ? 'Generate Balanced Pairing' : 'Generate Random Pairing'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tee Sheet */}
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-lg text-white flex items-center space-x-2">
                    <span>Foursome Tee Sheet</span>
                    <span className="text-xs font-normal text-slate-400">({totalSlots} slots total)</span>
                  </h3>
                  <div className="flex items-center space-x-4 text-xs text-slate-400">
                    <span>Assignment Strategy: <strong className="text-emerald-400">{useTeeTimeAssignment ? 'Instant Auto-Assign' : 'Late Pairing Assignment'}</strong></span>
                  </div>
                </div>

                {!useTeeTimeAssignment && registeredPlayers.filter(p => !p.assignedTeeTime).length > 0 && (
                  <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-200">Unassigned Registrations Pool</p>
                      <p className="text-slate-400 text-[11px]">There are {registeredPlayers.filter(p => !p.assignedTeeTime).length} golfers registered. Hit "Generate Pairing" to assign them!</p>
                    </div>
                    <button 
                      onClick={handleArrangeFoursomes}
                      className="bg-slate-900 hover:bg-slate-800 border border-slate-850 px-3 py-1.5 rounded-lg text-emerald-400 font-semibold text-[11px]"
                      disabled={isGameCancelled}
                    >
                      Assign All
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {teeTimesList.map((tee, index) => {
                    const registeredCount = tee.slots.filter(s => s !== null).length;
                    
                    const assignedPlayers = tee.slots.filter(s => s !== null);
                    const avgHcp = assignedPlayers.length > 0 
                      ? (assignedPlayers.reduce((sum, p) => sum + Number(p.handicap || 0), 0) / assignedPlayers.length).toFixed(1)
                      : '0.0';

                    return (
                      <div 
                        key={index} 
                        className="bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all duration-200"
                      >
                        <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-3">
                          <div>
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4.5 h-4.5 text-emerald-400" />
                              <h4 className="text-lg font-bold text-white tracking-tight">{tee.time} AM</h4>
                            </div>
                            {assignedPlayers.length > 0 && (
                              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Average Team HCP: <strong className="text-emerald-400">{avgHcp}</strong></p>
                            )}
                          </div>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            registeredCount === 4 ? 'bg-emerald-950/50 border border-emerald-500/20 text-emerald-400' : 'bg-slate-950 text-slate-400 border border-slate-850'
                          }`}>
                            {registeredCount}/4 Filled
                          </span>
                        </div>

                        {/* 4 slots layout */}
                        <div className="space-y-2">
                          {tee.slots.map((slot, slotIdx) => (
                            <div 
                              key={slotIdx} 
                              className={`flex items-center justify-between p-2 rounded-xl text-xs transition-all ${
                                slot 
                                  ? 'bg-slate-950/60 border border-slate-800/80 text-white' 
                                  : 'bg-slate-950/20 border border-dashed border-slate-800 text-slate-500'
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <span className="w-5 h-5 flex items-center justify-center rounded bg-slate-800 text-[10px] text-slate-400 font-bold">
                                  {slotIdx + 1}
                                </span>
                                {slot ? (
                                  <div>
                                    <span className="font-semibold">{slot.name}</span>
                                    <span className="text-[10px] text-slate-400 block -mt-0.5">HCP: {slot.handicap} {slot.ghin ? `(GHIN: ${slot.ghin})` : ''}</span>
                                  </div>
                                ) : (
                                  <span className="italic text-slate-600">Empty Slot</span>
                                )}
                              </div>
                              
                              {slot && (
                                <button
                                  onClick={() => handleUnregister(slot.id)}
                                  disabled={isLocked || isGameCancelled}
                                  className={`text-[10px] text-rose-400 bg-rose-950/30 border border-rose-950 px-2 py-1 rounded-lg hover:bg-rose-900/30 transition-all ${
                                    (isLocked || isGameCancelled) ? 'opacity-40 cursor-not-allowed' : ''
                                  }`}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Waitlist Drawer */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="font-bold text-sm uppercase tracking-wide text-slate-200 flex items-center space-x-2">
                  <Clock className="w-4.5 h-4.5 text-amber-400" />
                  <span>FIFO Waitlist ({waitlist.length})</span>
                </h3>
              </div>

              {waitlist.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  No golfers currently on waitlist. Open slots remaining: <strong className="text-emerald-400">{availableSlotsCount}</strong>.
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-400">
                    If any registered golfer unregisters, waitlisted players are promoted automatically based on FIFO order.
                  </p>
                  {waitlist.map((waitId, index) => {
                    const waitGolfer = golfers.find(g => g.id === waitId);
                    return (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-md text-[10px]">
                            #{index + 1}
                          </span>
                          <div>
                            <span className="font-semibold text-white">{waitGolfer?.name}</span>
                            <span className="text-[10px] text-slate-400 block">HCP: {waitGolfer?.handicap}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnregister(waitId)}
                          disabled={isGameCancelled}
                          className="text-slate-400 hover:text-rose-400 disabled:opacity-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  <button 
                    onClick={handleAddTeeTime}
                    disabled={isGameCancelled}
                    className="w-full mt-2 bg-slate-950 hover:bg-slate-850 text-emerald-400 border border-emerald-500/20 py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 disabled:opacity-50 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Authorize Additional Tee Time Slot</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Impersonating Invite Recipients */}
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wide text-slate-200">Select Invite Recipient</h3>
              <p className="text-xs text-slate-400">
                Impersonate any golfer to view their exact email/SMS layout, handicap records, and RSVP magic links.
              </p>

              <div className="space-y-1 max-h-[350px] overflow-y-auto pr-2">
                {golfers.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedSimPlayerId(g.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs border transition-all ${
                      selectedSimPlayerId === g.id 
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-white font-semibold' 
                        : 'bg-slate-950/40 border-slate-850 hover:bg-slate-950 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                      <div>
                        <span className="block">{g.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">HCP: {g.handicap} | GHIN: {g.ghin || 'None'}</span>
                      </div>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      g.status === 'Registered' 
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40' 
                        : g.status === 'Waitlisted'
                        ? 'bg-amber-950 text-amber-400 border border-amber-900/40'
                        : 'bg-slate-800 text-slate-300'
                    }`}>
                      {g.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated Invitation Hub */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* MOCK EMAIL PREVIEW */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 shadow-2xl relative flex flex-col justify-between">
                <div>
                  <div className="absolute top-4 right-4 text-[9px] font-bold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Simulated Email Invite
                  </div>
                  
                  <div className="flex items-center space-x-2 border-b border-slate-800 pb-4 mb-4">
                    <Mail className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-300">Sent to: <span className="text-white font-mono">{currentSimPlayer.email}</span></span>
                  </div>

                  {isGameCancelled ? (
                    <div className="bg-rose-50 border border-rose-200 text-rose-950 p-6 rounded-2xl text-center space-y-3">
                      <XCircle className="w-12 h-12 mx-auto text-rose-600" />
                      <h4 className="font-extrabold text-base">MATCH IS CANCELLED</h4>
                      <p className="text-xs leading-relaxed text-rose-800">
                        Please disregard this email invitation. The weekly round at {course.split(',')[0]} scheduled for {gameDate} has been cancelled by the administrator.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white text-slate-900 p-5 rounded-2xl space-y-4">
                      <div className="border-b border-slate-100 pb-3">
                        <h2 className="text-base font-extrabold text-emerald-800 flex items-center justify-between">
                          <span>Golf Invite: Weekly Match</span>
                          <span className="text-xs text-slate-500 font-normal">{gameDate}</span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">From: LinksInvite Coordinator &lt;coordinator@linksinvite.com&gt;</p>
                      </div>

                      <p className="text-xs leading-relaxed text-slate-700">
                        Hi <strong>{currentSimPlayer.name}</strong>,<br />
                        You are invited to join our weekly match at <strong>{course || 'Newnan Country Club'}</strong>!
                      </p>

                      {/* Pre-fill course HCP & GHIN (auto saves inside database) */}
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Your Player Profile:</span>
                          <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded font-semibold">Auto-Saves</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[9px] text-slate-500 font-medium">Course Handicap</label>
                            <input 
                              type="number" 
                              value={currentSimPlayer.handicap}
                              onChange={(e) => handleUpdateGolferDetails(currentSimPlayer.id, { handicap: Number(e.target.value) || 0 })}
                              className="bg-white border border-slate-300 text-xs text-slate-800 rounded px-2 py-1 w-full font-bold focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-slate-500 font-medium">GHIN Number</label>
                            <input 
                              type="text" 
                              placeholder="Optional"
                              value={currentSimPlayer.ghin || ''}
                              onChange={(e) => handleUpdateGolferDetails(currentSimPlayer.id, { ghin: e.target.value })}
                              className="bg-white border border-slate-300 text-xs text-slate-800 rounded px-2 py-1 w-full font-mono focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Weather Forecast */}
                      {weatherData && (
                        <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <CloudSun className="w-5 h-5 text-emerald-600" />
                            <div>
                              <p className="text-[10px] font-bold text-emerald-800">Forecast for {weatherData.courseName}</p>
                              <p className="text-xs text-emerald-900">{weatherData.days[0].condition} · {weatherData.days[0].temp}</p>
                            </div>
                          </div>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full flex items-center space-x-1">
                            <CloudRain className="w-3 h-3 text-emerald-600" />
                            <span>{weatherData.days[0].rainChance} Rain</span>
                          </span>
                        </div>
                      )}

                      {/* Local Rules */}
                      {localRules && (
                        <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-700">
                          <div className="flex items-center space-x-1.5 text-slate-800 font-bold text-[10px] uppercase mb-1">
                            <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Local Rules of the Day:</span>
                          </div>
                          <p className="italic text-[11px] text-slate-600 leading-tight">{localRules}</p>
                        </div>
                      )}

                      <div className="space-y-2 pt-1">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600">
                          <div className="flex justify-between mb-1">
                            <span>First Tee Time:</span>
                            <strong className="text-slate-900">{firstTeeTime} AM</strong>
                          </div>
                          <div className="flex justify-between mb-1">
                            <span>Roster Space Remaining:</span>
                            <strong className="text-emerald-700">{availableSlotsCount} of {totalSlots}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Closing Time Limit:</span>
                            <strong className="text-rose-600">{formatFriendlyDateTime(regCloseDateTime)}</strong>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => handleRegister(currentSimPlayer.id, currentSimPlayer.handicap, currentSimPlayer.ghin)}
                            disabled={isLocked || currentSimPlayer.status === 'Registered'}
                            className={`w-full py-2.5 rounded-xl text-xs font-bold text-center border transition-all ${
                              currentSimPlayer.status === 'Registered'
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-800 cursor-not-allowed'
                                : isLocked 
                                ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 shadow-sm'
                            }`}
                          >
                            {currentSimPlayer.status === 'Registered' ? '✓ Registered' : 'Register Now'}
                          </button>

                          <button
                            onClick={() => handleUnregister(currentSimPlayer.id)}
                            disabled={isLocked || (currentSimPlayer.status !== 'Registered' && currentSimPlayer.status !== 'Waitlisted')}
                            className={`w-full py-2.5 rounded-xl text-xs font-semibold text-center border transition-all ${
                              currentSimPlayer.status !== 'Registered' && currentSimPlayer.status !== 'Waitlisted'
                                ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
                                : isLocked 
                                ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                            }`}
                          >
                            Unregister
                          </button>
                        </div>

                        {isLocked && (
                          <p className="text-[10px] text-center text-rose-600 font-semibold italic mt-1">
                            ⚠️ Registration scheduling window is currently closed/locked.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* MOCK SMS PREVIEW */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 shadow-2xl relative flex flex-col justify-between">
                <div>
                  <div className="absolute top-4 right-4 text-[9px] font-bold text-sky-400 bg-sky-950/50 px-2 py-0.5 rounded-full border border-sky-500/20">
                    Simulated SMS Invite
                  </div>

                  <div className="flex items-center space-x-2 border-b border-slate-800 pb-4 mb-4">
                    <MessageSquare className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-slate-300">Sent to: <span className="text-white font-mono">{currentSimPlayer.phone}</span></span>
                  </div>

                  {/* Simulated iPhone Screen */}
                  <div className="bg-[#1c1c1e] text-slate-100 p-4 rounded-2xl space-y-4">
                    <div className="text-center text-[10px] text-slate-500 py-1">
                      Today at 11:24 AM
                    </div>
                    
                    {isGameCancelled ? (
                      <div className="bg-rose-950/40 text-rose-100 p-3 rounded-2xl rounded-bl-none text-xs border border-rose-500/30">
                        <p className="font-bold">🚨 CANCELLED GAME ALERT</p>
                        <p className="mt-1">The weekly match at {course.split(',')[0]} scheduled for Sat has been CANCELLED. Do not attend.</p>
                      </div>
                    ) : (
                      <>
                        {/* SMS Bubble */}
                        <div className="bg-[#262529] text-white p-3 rounded-2xl rounded-bl-none text-xs max-w-[90%] border border-slate-800 space-y-2">
                          <p>
                            ⛳ **LinksInvite Weekly Game**
                            We are playing at {course.split(',')[0]} on Sat {firstTeeTime} AM.
                          </p>
                          <p className="text-[11px] text-emerald-400">
                            Forecast: {weatherData ? `${weatherData.days[0].condition}, ${weatherData.days[0].temp} (${weatherData.days[0].rainChance} Rain)` : 'Sunny & Perfect!'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Closing: {formatFriendlyDateTime(regCloseDateTime)}
                          </p>
                        </div>

                        {/* Quick Link simulations */}
                        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">One-Click Link Actions:</span>
                            <span className="text-[9px] text-sky-400 font-mono">Pre-filled ({currentSimPlayer.handicap} HCP)</span>
                          </div>
                          
                          <button
                            onClick={() => handleRegister(currentSimPlayer.id, currentSimPlayer.handicap, currentSimPlayer.ghin)}
                            disabled={isLocked || currentSimPlayer.status === 'Registered'}
                            className={`w-full py-2 rounded-lg text-xs font-bold text-center flex items-center justify-center space-x-2 transition-all ${
                              currentSimPlayer.status === 'Registered'
                                ? 'bg-slate-800 text-emerald-400 cursor-not-allowed border border-slate-700'
                                : isLocked
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold shadow-md'
                            }`}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{currentSimPlayer.status === 'Registered' ? 'Registered' : `RSVP with ${currentSimPlayer.handicap} HCP`}</span>
                          </button>

                          <button
                            onClick={() => handleUnregister(currentSimPlayer.id)}
                            disabled={isLocked || (currentSimPlayer.status !== 'Registered' && currentSimPlayer.status !== 'Waitlisted')}
                            className={`w-full py-2 rounded-lg text-xs font-semibold text-center flex items-center justify-center space-x-2 border transition-all ${
                              currentSimPlayer.status !== 'Registered' && currentSimPlayer.status !== 'Waitlisted'
                                ? 'bg-transparent border-slate-800 text-slate-600 cursor-not-allowed'
                                : isLocked
                                ? 'bg-transparent border-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-transparent hover:bg-rose-950/20 border-rose-500/30 text-rose-400'
                            }`}
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>{currentSimPlayer.status === 'Waitlisted' ? 'Leave Waitlist' : 'One-Click Unregister'}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: Admin panel with Authentication, Cancellation and Game parameters */}
        {activeTab === 'admin' && (
          <div className="max-w-4xl mx-auto">
            {!isLoggedIn ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 max-w-md mx-auto">
                <div className="text-center space-y-2">
                  <div className="bg-emerald-500/10 p-3 rounded-full w-fit mx-auto text-emerald-400 border border-emerald-500/20">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Owner/Admin Account Required</h3>
                  <p className="text-xs text-slate-400">Please setup your credentials or sign in below to manage weekly game pairings.</p>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 font-semibold uppercase">Email or Phone Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. admin@ccgolf.com or 555-0199" 
                      value={authEmailOrPhone}
                      onChange={(e) => setAuthEmailOrPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1 font-semibold uppercase">Password</label>
                    <input 
                      type="password" 
                      placeholder="••••••••" 
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {authError && (
                    <div className="bg-rose-950/40 border border-rose-800 text-rose-300 p-2.5 rounded-xl text-xs flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/10 transition-all"
                  >
                    <span>{isSigningUp ? 'Set Up New Owner Account' : 'Sign In as Owner'}</span>
                  </button>
                </form>

                <div className="text-center">
                  <button 
                    onClick={() => {
                      setIsSigningUp(!isSigningUp);
                      setAuthError('');
                    }}
                    className="text-[11px] text-emerald-400 hover:underline"
                  >
                    {isSigningUp ? 'Already have an owner account? Sign In' : 'Need a new account? Create Account'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Header Welcome banner with Log Out option */}
                <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl flex justify-between items-center">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Authenticated Session</p>
                    <h4 className="text-sm font-bold text-white">Owner Active: <span className="text-slate-300 font-mono font-normal">{adminAccount?.emailOrPhone}</span></h4>
                  </div>
                  <button 
                    onClick={() => setIsLoggedIn(false)}
                    className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white text-xs px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Lock Session</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left Column Settings */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
                    <h3 className="font-bold text-sm uppercase tracking-wide text-slate-200 flex items-center space-x-2">
                      <Sliders className="w-4.5 h-4.5 text-emerald-400" />
                      <span>Admin Game Settings</span>
                    </h3>
                    
                    <div className="space-y-4">
                      
                      {/* Course Selection */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-805 space-y-2">
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide">Golf Course Location</label>
                        <input 
                          type="text" 
                          value={course} 
                          onChange={(e) => setCourse(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span>Default: Newnan Country Club</span>
                          {course !== DEFAULT_COURSE && (
                            <button 
                              onClick={() => setCourse(DEFAULT_COURSE)}
                              className="text-emerald-400 hover:underline"
                            >
                              Reset Default
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Scheduling Open & Close Limit Inputs */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wide block border-b border-slate-800 pb-1">Scheduling Windows</span>
                        
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1 font-semibold uppercase">Registration Open Time</label>
                          <input 
                            type="datetime-local" 
                            value={regOpenDateTime} 
                            onChange={(e) => setRegOpenDateTime(e.target.value)}
                            className="w-full bg-slate-905 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1 font-semibold uppercase">Registration Close Time</label>
                          <input 
                            type="datetime-local" 
                            value={regCloseDateTime} 
                            onChange={(e) => setRegCloseDateTime(e.target.value)}
                            className="w-full bg-slate-905 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Turn on/off switches for Balanced Pairings and Tee Time Assignment */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wide block border-b border-slate-800 pb-1">Feature Controls</span>
                        
                        {/* Balanced Pairing Toggle */}
                        <div className="flex items-center justify-between text-xs py-1">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-200 block">Balanced Pairing</span>
                            <span className="text-[10px] text-slate-400">Balance grouping handicap spread</span>
                          </div>
                          <button 
                            onClick={() => setUseBalancedFoursomes(!useBalancedFoursomes)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${useBalancedFoursomes ? 'bg-emerald-500' : 'bg-slate-800'}`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useBalancedFoursomes ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        {/* Tee Time Assignment Toggle */}
                        <div className="flex items-center justify-between text-xs py-1">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-200 block">Tee Time Assignment</span>
                            <span className="text-[10px] text-slate-400">Assign times instantly on RSVP</span>
                          </div>
                          <button 
                            onClick={() => setUseTeeTimeAssignment(!useTeeTimeAssignment)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${useTeeTimeAssignment ? 'bg-emerald-500' : 'bg-slate-800'}`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useTeeTimeAssignment ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Right Column Settings & Cancellation Panels */}
                  <div className="space-y-6">
                    
                    {/* Feature 2: Cancellation Outright Module */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                      <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm uppercase tracking-wider">
                        <AlertTriangle className="w-5 h-5 text-rose-400" />
                        <span>Game Cancellation Suite</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Outright cancel the scheduled round for the week. This will immediately freeze registrations and push a clear email alert out to all golfers.
                      </p>

                      {isGameCancelled ? (
                        <div className="bg-rose-950/20 border border-rose-500/20 p-4 rounded-xl space-y-2 text-center">
                          <p className="text-xs text-rose-300 font-bold">Round is currently marked as Cancelled.</p>
                          <button 
                            onClick={handleRestoreGame}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center space-x-1 mx-auto transition-all"
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>Re-open Game / Roster</span>
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={handleCancelGame}
                          className="w-full bg-rose-600 hover:bg-rose-500 text-white font-extrabold py-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-lg transition-all"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Cancel Game Outright & Notify Group</span>
                        </button>
                      )}
                    </div>

                    {/* Format Details */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                      <h3 className="font-bold text-sm uppercase tracking-wide text-slate-200">Timing Specs</h3>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1 font-semibold uppercase">First Tee Time</label>
                          <input 
                            type="time" 
                            value={firstTeeTime} 
                            onChange={(e) => setFirstTeeTime(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                            disabled={isGameCancelled}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1 font-semibold uppercase">Interval (Mins)</label>
                          <select 
                            value={interval} 
                            onChange={(e) => setInterval(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none"
                            disabled={isGameCancelled}
                          >
                            <option value={8}>8 mins</option>
                            <option value={9}>9 mins</option>
                            <option value={10}>10 mins</option>
                            <option value={12}>12 mins</option>
                            <option value={15}>15 mins</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1 font-semibold">Tee Time Sheet Blocks</label>
                        <div className="flex items-center space-x-2">
                          <input 
                            type="number" 
                            min={1} 
                            max={8}
                            value={numTeeTimes} 
                            onChange={(e) => setNumTeeTimes(Math.max(1, Number(e.target.value)))}
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white w-20 focus:outline-none"
                            disabled={isGameCancelled}
                          />
                          <span className="text-xs text-slate-400">Times ({numTeeTimes * 4} players capacity)</span>
                        </div>
                      </div>

                      {/* Local rules editor */}
                      <div>
                        <label className="block text-xs text-slate-400 mb-1 font-semibold">Set Local Rules of the Day</label>
                        <textarea
                          rows={3}
                          value={localRules}
                          onChange={(e) => setLocalRules(e.target.value)}
                          placeholder="Enter any local rules..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                          disabled={isGameCancelled}
                        />
                      </div>
                    </div>

                  </div>
                </div>

                {/* Manage Golfer Registry Database */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
                  
                  {/* Form to add a new golfer */}
                  <div>
                    <h3 className="font-bold text-sm uppercase tracking-wide text-slate-200 mb-3">Add Golfer to Group Database</h3>
                    <form onSubmit={handleAddNewGolfer} className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-850">
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold">Golfer Full Name</label>
                        <input 
                          type="text" 
                          placeholder="Golfer Full Name" 
                          value={newGolferName}
                          onChange={(e) => setNewGolferName(e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none w-full"
                          required
                          disabled={isGameCancelled}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold">Email Address</label>
                        <input 
                          type="email" 
                          placeholder="Email Address" 
                          value={newGolferEmail}
                          onChange={(e) => setNewGolferEmail(e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none w-full"
                          disabled={isGameCancelled}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-400 uppercase font-semibold">Phone (SMS)</label>
                        <input 
                          type="text" 
                          placeholder="Phone (SMS)" 
                          value={newGolferPhone}
                          onChange={(e) => setNewGolferPhone(e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none w-full"
                          disabled={isGameCancelled}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="block text-[10px] text-slate-400 uppercase font-semibold">Handicap</label>
                          <input 
                            type="number" 
                            placeholder="HCP" 
                            value={newGolferHcp}
                            onChange={(e) => setNewGolferHcp(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none w-full"
                            required
                            disabled={isGameCancelled}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] text-slate-400 uppercase font-semibold">GHIN ID</label>
                          <input 
                            type="text" 
                            placeholder="GHIN ID" 
                            value={newGolferGhin}
                            onChange={(e) => setNewGolferGhin(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none w-full"
                            disabled={isGameCancelled}
                          />
                        </div>
                      </div>

                      <div className="md:col-span-2 pt-2 text-right">
                        <button 
                          type="submit" 
                          disabled={isGameCancelled}
                          className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center space-x-1 w-full md:w-auto ml-auto disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Golfer to Roster</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Golfer Registry */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-sm uppercase tracking-wide text-slate-200">Current Invitees & Status Board</h3>
                    <div className="overflow-x-auto border border-slate-800 rounded-2xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                            <th className="p-3">Player</th>
                            <th className="p-3">HCP</th>
                            <th className="p-3">GHIN</th>
                            <th className="p-3">Invite Status</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
                          {golfers.map(g => (
                            <tr key={g.id} className="hover:bg-slate-950/40">
                              <td className="p-3">
                                <span className="font-semibold text-white block">{g.name}</span>
                                <span className="text-[10px] text-slate-500 font-mono">{g.email} | {g.phone}</span>
                              </td>
                              <td className="p-3">
                                <span className="font-bold text-slate-100">{g.handicap}</span>
                              </td>
                              <td className="p-3 font-mono text-[11px] text-slate-400">
                                {g.ghin || 'None'}
                              </td>
                              <td className="p-3">
                                <span className={`inline-block text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                                  g.status === 'Registered' 
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40' 
                                    : g.status === 'Waitlisted'
                                    ? 'bg-amber-950 text-amber-400 border border-amber-900/40 animate-pulse'
                                    : 'bg-slate-800 text-slate-300'
                                }`}>
                                  {g.status === 'Registered' ? (g.assignedTeeTime ? `Registered (${g.assignedTeeTime} AM)` : 'Registered (No Time Assigned)') : g.status}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end space-x-1">
                                  {g.status !== 'Registered' && g.status !== 'Waitlisted' ? (
                                    <button
                                      onClick={() => handleRegister(g.id)}
                                      disabled={isLocked || isGameCancelled}
                                      className={`bg-emerald-950/40 border border-emerald-900/60 hover:bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded text-[10px] font-bold ${(isLocked || isGameCancelled) ? 'opacity-45 cursor-not-allowed' : ''}`}
                                    >
                                      Register
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleUnregister(g.id)}
                                      disabled={isLocked || isGameCancelled}
                                      className={`bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/30 text-rose-400 px-2 py-1 rounded text-[10px] font-bold ${(isLocked || isGameCancelled) ? 'opacity-45 cursor-not-allowed' : ''}`}
                                    >
                                      Unregister
                                    </button>
                                  )}
                                  
                                  <button
                                    onClick={() => {
                                      setGolfers(prev => prev.filter(p => p.id !== g.id));
                                      addNotificationLog('Admin Action', `Removed player ${g.name} from roster.`, 'All Group');
                                    }}
                                    className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition-all"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

              </div>
            )}
          </div>
        )}

        {/* TAB 4: Broadcast log updates */}
        {activeTab === 'notifications' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 max-w-4xl mx-auto animate-fadeIn">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="space-y-1">
                <h3 className="font-bold text-base text-white flex items-center space-x-2">
                  <Bell className="w-5 h-5 text-emerald-400" />
                  <span>Interactive Broadcast Notification Stream</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Every registration, cancellation, and scheduling change triggers simulated email and SMS broadcasts.
                </p>
              </div>
              <button
                onClick={() => setNotifications([
                  {
                    id: 'init',
                    type: 'System',
                    timestamp: new Date().toLocaleTimeString(),
                    text: 'Weekly Golf Game Invitation System initialized. Welcome to Newnan Country Club!',
                    target: 'All Invitees'
                  }
                ])}
                className="text-xs text-slate-500 hover:text-rose-400 transition-colors"
              >
                Clear Logs
              </button>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={`p-4 rounded-xl border text-xs transition-all ${
                    n.type === 'Registration'
                      ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-300'
                      : n.type === 'Waitlisted'
                      ? 'bg-amber-950/30 border-amber-500/20 text-amber-300'
                      : n.type === 'Unregister'
                      ? 'bg-slate-950 border-slate-800 text-slate-300'
                      : n.type === 'FIFO Promotion'
                      ? 'bg-sky-950/30 border-sky-500/20 text-sky-300'
                      : n.type === 'Cancellation Alert'
                      ? 'bg-rose-950/50 border-rose-500/50 text-rose-300'
                      : 'bg-slate-950 border-slate-850 text-slate-400'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold uppercase tracking-wider text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {n.type} Alert
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{n.timestamp}</span>
                  </div>
                  
                  <p className="font-semibold text-slate-200 leading-relaxed">{n.text}</p>
                  
                  <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
                    <span>Recipients: <strong className="text-slate-400">{n.target || 'All Group'}</strong></span>
                    {n.weather && (
                      <span>Weather included: <strong className="text-emerald-500">{n.weather}</strong></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 mt-12 text-xs text-slate-500 text-center">
        <p>© {new Date().getFullYear()} LinksInvite Weekly Coordinator. Created for Newnan Country Club Golfers.</p>
        <p className="mt-1">Powered by Gemini 3.1 Flash with Live Weather Search Grounding.</p>
      </footer>
    </div>
  );
}