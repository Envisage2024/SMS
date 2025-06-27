        // Initialize map centered on Uganda
        const map = L.map('map').setView([1.3733, 32.2903], 7);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Function to fetch hospitals in Uganda
        const fetchHospitals = () => {
            const url = 'https://nominatim.openstreetmap.org/search?country=Uganda&amenity=hospital&format=json&limit=50';
            
            fetch(url)
                .then(response => response.json())
                .then(data => {
                    data.forEach(hospital => {
                        const lat = parseFloat(hospital.lat);
                        const lon = parseFloat(hospital.lon);
                        const name = hospital.display_name || "Hospital";

                        L.marker([lat, lon])
                            .addTo(map)
                            .bindPopup(`<strong>${name}</strong>`);
                    });
                })
                .catch(error => console.error('Error fetching hospitals:', error));
        };

        // Fetch hospitals in Uganda
        fetchHospitals();

        // Get user's location and search for nearby hospitals
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                const userLat = position.coords.latitude;
                const userLon = position.coords.longitude;

                // Center map on user's location
                map.setView([userLat, userLon], 12);
                
                // Mark user's location
                L.marker([userLat, userLon]).addTo(map).bindPopup("You are here").openPopup();

                // Fetch nearby hospitals
                const fetchNearbyHospitals = () => {
                    const url = `https://nominatim.openstreetmap.org/search?q=hospital&format=json&limit=50&viewbox=${userLon-0.2},${userLat+0.2},${userLon+0.2},${userLat-0.2}`;
                    
                    fetch(url)
                        .then(response => response.json())
                        .then(data => {
                            data.forEach(hospital => {
                                const lat = parseFloat(hospital.lat);
                                const lon = parseFloat(hospital.lon);
                                const name = hospital.display_name || "Nearby Hospital";

                                L.marker([lat, lon])
                                    .addTo(map)
                                    .bindPopup(`<strong>${name}</strong>`);
                            });
                        })
                        .catch(error => console.error('Error fetching nearby hospitals:', error));
                };

                fetchNearbyHospitals();
            });
        } else {
            console.error('Geolocation is not supported by this browser.');
        }
