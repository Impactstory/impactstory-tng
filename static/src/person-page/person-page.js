angular.module('personPage', [
    'ngRoute',
    'person'
])



    .config(function($routeProvider) {
        $routeProvider.when('/u/:orcid/:tab?/:filter?', {
            templateUrl: 'person-page/person-page.tpl.html',
            controller: 'personPageCtrl',
            reloadOnSearch: false,
            resolve: {
                personResp: function($q, $http, $rootScope, $route, $location, Person, CurrentUser){
                    console.log("person is loading!", $rootScope)
                    var urlId = $route.current.params.orcid

                    if (urlId.indexOf("0000-") === 0){ // got an ORCID

                        // if this is my profile
                        if (urlId == CurrentUser.d.orcid_id) {
                            var redirecting = CurrentUser.sendHome()
                            if (redirecting){
                                var deferred = $q.defer()
                                return deferred.promise
                            }
                        }

                        return Person.load(urlId)
                    }
                    else { // got a twitter name
                        console.log("got something other than an orcid in the slug. trying as twitter ID")
                        var deferred = $q.defer()

                        $http.get("/api/person/twitter_screen_name/" + urlId)
                            .success(function(resp){
                                console.log("this twitter name has an ORCID. redirecting there: ", resp.id)
                                // we don't reject of resolve the promise. that's
                                // to keep this route from resolving and showing garbage while
                                // the redirect is loading.
                                $location.url("/u/" + resp.id)
                            })
                            .error(function(resp){
                                console.log("got 404 resp back about the twitter name")
                                deferred.reject()
                            })
                        return deferred.promise
                    }
                }
            }
        })
    })



    .controller("personPageCtrl", function($scope,
                                           $routeParams,
                                           $rootScope,
                                           $route,
                                           $http,
                                           $auth,
                                           $mdDialog,
                                           $location,
                                           $timeout,
                                           $sce,
                                           Person,
                                           NumFormat,
                                           personResp){





        $scope.global.title = Person.d.given_names + " " + Person.d.family_name
        $scope.person = Person
        $scope.products = Person.d.products
        $scope.sources = Person.d.sources
        $scope.badges = Person.badgesToShow()
        $scope.d = {}



        var badgeUrlName = function(badge){
           return badge.display_name.toLowerCase().replace(/\s/g, "-")
        }
        $scope.badgeUrlName = badgeUrlName

        console.log("retrieved the person", $scope.person)

        $scope.profileStatus = "all_good"

        // redirect the legacy "activity" tab to "timeline" (new name)
        if ($routeParams.tab == "activity"){
            console.log("activity tab")
            $location.url("u/" + Person.d.orcid_id + "/timeline")
        }


        // overview tab
        $scope.tab =  $routeParams.tab || "overview"
        if (!$routeParams.tab){
            $scope.tab = "overview"
        }



        // someone is linking to a specific badge. show overview page behind a popup
        else if ($routeParams.tab == "a") {
            $scope.tab = "achievements"
            var badgeName = $routeParams.filter
            console.log("show the badges modal, for this badge", badgeName)


            var badgeToShow = _.find(Person.d.badges, function(myBadge){
                return badgeName == badgeUrlName(myBadge)
            })
            var badgeDialogCtrl = function($scope){
                $scope.badge = badgeToShow
                $scope.badgeUrl = "/u/" + Person.d.orcid_id + "/a/" + badgeUrlName(badgeToShow)

                // this dialog has isolate scope so doesn't inherit this function
                // from the application scope.
                $scope.trustHtml = function(str){
                    return $sce.trustAsHtml(str)
                }
                $scope.cancel = function() {
                    $mdDialog.cancel();
                };
                $scope.firstName = Person.d.first_name
            }

            var dialogOptions = {
                clickOutsideToClose: true,
                templateUrl: 'badgeDialog.tpl.html',
                controller: badgeDialogCtrl
            }


            var showDialog = function(){
                $mdDialog.show(dialogOptions).then(function(result) {
                    console.log("ok'd the setFulltextUrl dialog")

                }, function() {
                    console.log("cancelled the setFulltextUrl dialog")
                    $location.url("u/" + Person.d.orcid_id + "/achievements")
                });
            }

            $timeout(showDialog, 0)


        }

        // the other tabs
        else {
            $scope.tab = $routeParams.tab
        }

        $scope.userForm = {}

        console.log("routeparamas", $routeParams)


        // this is used when you want to tweet your profile
        $scope.profileLinkToTweet = "https://impactstory.org/u/"
        if (Person.d.twitter){
            $scope.profileLinkToTweet += Person.d.twitter
        }
        else {
            $scope.profileLinkToTweet += Person.d.orcid_id
        }



        $scope.refreshFromSecretButton = function(){
            console.log("ah, refreshing!")

            // for testing
            //var url = "https://impactstory.org/api/person/" + Person.d.orcid_id

            // the real one
            var url = "/api/person/" + Person.d.orcid_id + "/refresh"

            $http.post(url)
                .success(function(resp){

                    // force the Person to reload. without this
                    // the newly-synced data never gets displayed.
                    console.log("reloading the Person")
                    Person.reload().then(
                        function(resp){
                            $scope.profileStatus = "all_good"
                            console.log("success, reloading page", resp)
                            $route.reload()
                        }
                    )
                })
        }


        $scope.shareProfile = function(){
            var myOrcid = $auth.getPayload().sub // orcid ID

            console.log("sharing means caring")
            var aDayAgo = moment().subtract(24, 'hours')
            var claimedAt = moment(Person.d.claimed_at)

            // which came first: a day ago, or when this was claimed?
            if (moment.min(aDayAgo, claimedAt) == aDayAgo){
                console.log("this profile is brand spankin' new! logging it.")

                $http.post("api/person/" + myOrcid + "/tweeted-quickly", {})
                    .success(function(resp){
                        console.log("logged the tweet with our DB", resp)
                    })

            }

        }

        $scope.shareBadge = function(badgeName){
            var myOrcid = $auth.getPayload().sub // orcid ID
        }

        $scope.showBadge = function(badge){
            $location.url("u/" + Person.d.orcid_id + "/a/" + badgeUrlName(badge))

        }






        // top of profile

        $scope.showAboutOaDialog = function(ev){

            $mdDialog.show({
                clickOutsideToClose: true,
                targetEvent: ev,
                templateUrl: 'aboutOaDialog.tpl.html',
                controller: function($scope){
                    console.log("running the showAboutOaDialog ctrl")
                    $scope.person = Person
                    $scope.numFormat = NumFormat
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                }
            })
        }











        // posts and timeline stuff
        var posts = []
        _.each(Person.d.products, function(product){
            var myDoi = product.doi
            var myPublicationId = product.id
            var myTitle = product.title
            _.each(product.posts, function(myPost){
                myPost.citesDoi = myDoi
                myPost.citesPublication = myPublicationId
                myPost.citesTitle = myTitle
                posts.push(myPost)
            })
        })

        function makePostsWithRollups(posts){
            var sortedPosts = _.sortBy(posts, "posted_on")
            var postsWithRollups = []
            function makeRollupPost(){
                return {
                    source: 'tweetRollup',
                    posted_on: '',
                    count: 0,
                    tweets: []
                }
            }
            var currentRollup = makeRollupPost()
            _.each(sortedPosts, function(post){
                if (post.source == 'twitter'){ // this post is a tween

                    // we keep tweets as regular posts too
                    postsWithRollups.push(post)

                    // put the tweet in the rollup
                    currentRollup.tweets.push(post)

                    // rollup posted_on date will be date of *first* tweet in group
                    currentRollup.posted_on = post.posted_on
                }
                else {
                    postsWithRollups.push(post)

                    // save the current rollup
                    if (currentRollup.tweets.length){
                        postsWithRollups.push(currentRollup)
                    }

                    // clear the current rollup
                    currentRollup = makeRollupPost()
                }
            })

            // there may be rollup still sitting around because no regular post at end
            if (currentRollup.tweets.length){
                postsWithRollups.push(currentRollup)
            }
            return postsWithRollups
        }

        $scope.posts = makePostsWithRollups(posts)


        // mendeley stuff.
        // currently not using this.

        //$scope.mendeleySource = _.findWhere(Person.d.sources, {source_name: "mendeley"})
        //$scope.mendeleyCountries = _.map(_.pairs(Person.d.mendeley.country_percent), function(countryPair){
        //    return {
        //        name: countryPair[0],
        //        percent: countryPair[1]
        //    }
        //})
        //
        //$scope.mendeleyDisciplines = _.map(_.pairs(Person.d.mendeley.subdiscipline_percent), function(pair){
        //    return {
        //        name: pair[0],
        //        percent: pair[1]
        //    }
        //})



        $scope.postsFilter = function(post){
            if ($scope.selectedChannel) {
                return post.source == $scope.selectedChannel.source_name
            }
            else { // we are trying to show unfiltered view

                // but even in unfiltered view we want to hide tweets.
                return post.source != 'twitter'

            }
        }

        $scope.postsSum = 0
        _.each(Person.d.sources, function(v){
            $scope.postsSum += v.posts_count
        })

        $scope.d.viewItemsLimit = 20
        $scope.selectedChannel = _.findWhere(Person.d.sources, {source_name: $routeParams.filter})

        $scope.toggleSelectedChannel = function(channel){
            console.log("toggling selected channel", channel)
            if (channel.source_name == $routeParams.filter){
                $location.url("u/" + Person.d.orcid_id + "/timeline")
            }
            else {
                $location.url("u/" + Person.d.orcid_id + "/timeline/" + channel.source_name)
            }
        }










        // genre stuff
        var genreGroups = _.groupBy(Person.d.products, "genre")
        var genres = []
        _.each(genreGroups, function(v, k){
            genres.push({
                name: k,
                display_name: k.split("-").join(" "),
                count: v.length
            })
        })

        $scope.genres = genres
        $scope.selectedGenre = _.findWhere(genres, {name: $routeParams.filter})
        $scope.toggleSeletedGenre = function(genre){
            if (genre.name == $routeParams.filter){
                $location.url("u/" + Person.d.orcid_id + "/publications")
            }
            else {
                $location.url("u/" + Person.d.orcid_id + "/publications/" + genre.name)
            }
        }











        // achievements stuff
        var subscoreSortOrder = {
            buzz: 1,
            engagement: 2,
            openness: 3,
            fun: 4
        }
        
        // put the badge counts in each subscore
        var subscores = _.map(Person.d.subscores, function(subscore){
            var matchingBadges = _.filter(Person.badgesToShow(), function(badge){
                return badge.group == subscore.name
            })
            subscore.badgesCount = matchingBadges.length
            subscore.sortOrder = subscoreSortOrder[subscore.name]
            return subscore
        })
        $scope.subscores = subscores
        $scope.selectedSubscore = _.findWhere(subscores, {name: $routeParams.filter})

        $scope.toggleSeletedSubscore = function(subscore){
            console.log("toggle subscore", subscore)
            if (subscore.name == $routeParams.filter){
                $location.url("u/" + Person.d.orcid_id + "/achievements")
            }
            else {
                $location.url("u/" + Person.d.orcid_id + "/achievements/" + subscore.name)
            }
        }











    })



