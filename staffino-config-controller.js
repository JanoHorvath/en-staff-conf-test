angular.module('sdk', [
    'ng',
    'enplug',
    'ngSanitize',
    'ui.select',
    'ui.bootstrap',
    'uiSwitch'
    ])

    .controller('StaffinoConfigController', function ($scope, $enplug, $log, venueService, authService) {
        var token, userId, enplugVenueId;

        $scope.loggedIn = false;
        $scope.errorMessage = ""; //this is displayed to the user
        $scope.venues = [];
        $scope.settings = {
            //default:
            realtime: true,
            videoFrequency: 10
        };

        $enplug.getAccount(function(account){
                $log.info("Successfully retrieved account");
                enplugVenueId = account.id;

            },function(error){
                $log.error("Could not get EnplugAccount.", error);
            });

        $scope.logIn = function() {

            authService.login($scope.email, $scope.password)
                .success(function(data, status, headers, config) {

                    // Manual error handling because server always returns 200.. I know right!?
                    if (data.error == null) {
                        $log.info("Login successfull.");
                        $scope.loggedIn = true;
                        token = headers('X-AppUser-Token');
                        userId = headers('X-AppUser-ID');

                        $log.info('Fetching venues');
                        venueService.getVenues(token, userId)
                            .success(function(responseData) {
                                if (responseData.error == null) {
                                    angular.forEach(responseData.employments, function (employment) {
                                        this.push(employment.venue);
                                    }, $scope.venues);

                                    $log.info("Venues retrieved successfully");
                                } else {
                                    $scope.errorMessage = responseData.error.message;
                                    $log.error('Could not get Venues', responseData.error);
                                }
                            })
                            .error(function(data, status, headers, config){
                                // Although until server code changes, this will never get called
                                $scope.errorMessage = status;
                                $log.error('Unable to connect to server. Are you connected to the internet? Status:', status);
                            })
                    } else{
                        $scope.errorMessage = data.error.message;
                        $log.error('Authentication error. Code: ', data.error.code, ': ', data.error.message);
                    }
                })
                .error(function(data, status, headers, config){
                    // Although until server code changes, this will never get called
                    $scope.errorMessage = status;
                    $log.error('Unable to connect to server. Are you connected to the internet? Status:', status);
                })
        };

        $scope.updateRatio = function(){
            videoFrequency = $scope.settings.videoFrequency;
            if (videoFrequency == null) {
                videoFrequency = 10;
            }

            if (videoFrequency > 0) {
                $scope.ratio = "1:"+ videoFrequency;
            } else {
                if (videoFrequency == 0){
                    $scope.ratio = "1:1";
                } else {
                    $scope.ratio = Math.abs(videoFrequency)+":1";
                }
            }
        };
        $scope.updateRatio(); // so that $scope.ratio is defined from the beginning

        $scope.selectedVenue = function(venue){
            $log.info('User has selected ', venue.name);
            $scope.settings['venueID'] = venue.venueID;
        };

        $scope.submitForm = function(){
            venueService.associateIDs(token, userId, $scope.settings['venueID'], enplugVenueId)
                .success(function(response){
                    if (response.venue != null) {
                        $log.info("POST successful. EnplugVenueId has been saved to db.");
                        updateOrCreateAsset();
                    } else {
                        $scope.errorMessage = response.error.message;
                        $log.error("POST failed. Unable to associate EnplugVenueId.")
                    }
                })
                .error(function(data, status, headers, config){
                    $scope.errorMessage = status;
                    $log.error("POST failed miserably. Status: ", status);
                });
        };

        updateOrCreateAsset = function(){
            json = JSON.stringify($scope.settings);

            // Checks if the settings asset already exists
            $enplug.getAssets(
                function(assets){

                if (assets.indexOf('settings') > -1) {
                    // If it does, it updates the asset
                    $log.info(assets);
                    $enplug.updateAsset("settings", json, function(){
                        $log.info("UPDATE success", json)
                    }, function() {
                        $scope.errorMessage = 'Failed to update data on Enplug server.';
                        $log.error('Failed to UPDATE assets');
                    });

                } else {
                    // else it creates a new one
                    $enplug.createAsset("settings", json,  function(){
                        $log.info("CREATE success", json)
                    }, function() {
                        $scope.errorMessage = 'Failed to update data on Enplug server.';
                        $log.error('Failed to CREATE assets');
                    });
                }
            }, function(error){
                $scope.errorMessage = 'Failed to get data from Enplug server.';
                $log.error('Failed to GET assets', error);
            });
        }

    })

    .service('venueService', function ($http) {
        return {
            getVenues: function(token, userId) {
                var request = {
                    method: 'GET',
                    url: 'https://api.staffino.com/api/v3/user/employments/manager',
                    headers: {
                        'X-AppUser-Token': token,
                        'X-AppUser-ID': userId
                    }
                };
                return $http(request);
            },
            associateIDs: function(token, userId, venueId, enplugVenueId) {
                var request = {
                    // TODO: input actual enplugID
                    method: 'PUT',
                    url: 'https://api.staffino.com/api/v3/manager/venues/' + venueId + '/enplug',
                    headers: {
                        'X-AppUser-Token': token,
                        'X-AppUser-ID': userId
                    },
                    data: {
                        'enplugID': "12345"
                    }
                };
                return $http(request);
            }
        }
    })

    .service('authService', function ($http) {
        return {
            login: function(email, pass) {
                var request = {
                    method: 'POST',
                    url: 'https://api.staffino.com/api/v3/users/login/email',
                    data: {
                        email: email,
                        password: pass
                    }
                };
                return $http(request);
            }
        }
});