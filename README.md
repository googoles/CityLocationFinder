# City Direction & Distance Finder

This web application allows you to find the distance and direction to a city from your current location.

## Features

*   **Geolocation:** Automatically fetches your current location.
*   **City Selection:** Choose from a list of countries and cities, or enter custom coordinates.
*   **Real-time Compass:** A compass that shows your current orientation and the direction of the target city.
*   **Multi-language Support:** The interface is available in English, Korean, Japanese, Chinese, and Spanish.
*   **Responsive Design:** Works on both desktop and mobile devices.

## How to Use

1.  Open the `index.html` file in your web browser.
2.  Allow the browser to access your location.
3.  Select a country and a city from the dropdown menus.
4.  The application will display the distance and direction to the selected city.

## File Structure

*   `index.html`: The main HTML file.
*   `css/style.css`: Contains all the styles for the application.
*   `js/data.js`: Contains the translation strings and city data.
*   `js/ui.js`: Functions for updating the user interface.
*   `js/location.js`: Functions for handling geolocation and calculations.
*   `js/compass.js`: Functions for the compass and device orientation sensors.
*   `js/main.js`: The main script that initializes the application.